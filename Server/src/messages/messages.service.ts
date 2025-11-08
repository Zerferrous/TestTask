import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import puppeteer from 'puppeteer-extra';
import { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { MessageDto } from './dto/message.dto';

@Injectable()
export class MessagesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessagesService.name);
  private browser: Browser;
  private page: Page;
  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleDestroy() {
    await this.browser.close();
  }

  async onModuleInit() {
    try {
      this.logger.log('Инициализация Puppeteer.');
      this.browser = await puppeteer.use(StealthPlugin()).launch({
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      this.page = await this.browser.newPage();
      this.logger.log('Переход на страницу авторизации...');
      await this.page.goto('https://www.avito.ru/#login?authsrc=h', {
        waitUntil: 'domcontentloaded',
      });
    } catch {
      this.logger.error('Ошибка при переходе на страницу.');
    }

    try {
      this.logger.log('Ожидание поля ввода логина...');
      await this.page.locator('[data-marker="login-form/login/input"]').wait();
    } catch (err) {
      this.logger.error(
        'Поле ввода логина не обнаружено.\nВозможные причины:\n1)Авито потребовал решение каптчи\n2)Авито заблокировал IP-адрес',
      );
      throw err;
    }

    try {
      this.logger.log('Ввод логина...');
      await this.page
        .locator('[data-marker="login-form/login/input"]')
        .fill(this.configService.getOrThrow<string>('AVITO_USERNAME'));
    } catch (err) {
      this.logger.error('Ошибка при вводе логина.');
      throw err;
    }

    try {
      this.logger.log('Ввод пароля...');
      await this.page
        .locator('[data-marker="login-form/password/input"]')
        .fill(this.configService.getOrThrow<string>('AVITO_PASSWORD'));
    } catch (err) {
      this.logger.error('Ошибка при вводе пароля.');
      throw err;
    }

    try {
      await this.page.locator('[data-marker="login-form/submit"]').click();
    } catch (err) {
      this.logger.error('Ошибка подтверждении данных.');
      throw err;
    }

    try {
      this.logger.log('Ожидание входа в аккаунт.');
      await this.page.locator('[data-marker="header/menu-profile"]').wait();
      this.logger.log('Выполнен вход в аккаунт.');
    } catch (err) {
      this.logger.error(
        'Ошибка при входе в аккаунт. Возможно, потребовался код подтверждения (Отключите в настройках профиля Авито)',
      );
      throw err;
    }

    try {
      this.logger.log('Переход на страницу сообщений...');
      await this.page.goto('https://www.avito.ru/profile/messenger');
    } catch (err) {
      this.logger.error('Ошибка при переходе на страницу сообщений.');
      throw err;
    }

    this.logger.log('Поиск чата со слушаемым пользователем...');
    while (true) {
      try {
        await this.page.waitForSelector(
          `[data-marker="channels/user-title"] span ::-p-text(${this.configService.getOrThrow<string>('AVITO_TARGET_USERNAME')})`,
          { timeout: 5000 },
        );
        this.logger.log('Чат найден.');
        break;
      } catch {
        this.logger.log('Чат не найден. Повтор...');
      }
    }

    try {
      this.logger.log('Открытие чата...');
      await this.page
        .locator(
          `[data-marker="channels/user-title"] span ::-p-text(${this.configService.getOrThrow<string>('AVITO_TARGET_USERNAME')})`,
        )
        .click();
    } catch (err) {
      this.logger.error('Ошибка при открытии чата.');
      throw err;
    }

    this.logger.log('Слушает сообщения...');

    this.page.on('console', (msg) => {
      try {
        const data: MessageDto = JSON.parse(msg.text());
        if (data.type === 'message') {
          this.logger.log(
            `Обнаружено новое сообщение: [${data.direction}] ${data.text}`,
          );

          this.eventEmitter.emit('message.recieved', data);
        }
      } catch {
        this.logger.debug(`Puppeteer log: ${msg.text()}`);
      }
    });

    await this.page.evaluate(() => {
      const messagesRoot = document.querySelector(
        '[data-marker="messagesHistory/list"]',
      );
      if (!messagesRoot) {
        console.error('Контейнер сообщений не найден');
        return;
      }
      console.log('Наблюдение за новыми сообщениями запущено');
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!(node instanceof HTMLElement)) continue;
            if (node.matches('[data-marker="message"]')) {
              const textEl = node.querySelector('[data-marker="messageText"]');
              const text = textEl?.textContent?.trim() ?? '';
              const time = node.querySelector('time')?.getAttribute('datetime');
              const isIncoming = JSON.stringify(node.classList).includes(
                'message-base-module-left',
              );
              const isOutgoing = JSON.stringify(node.classList).includes(
                'message-base-module-right',
              );
              if (text) {
                console.log(
                  JSON.stringify({
                    type: 'message',
                    direction: isIncoming
                      ? 'incoming'
                      : isOutgoing
                        ? 'outgoing'
                        : 'unknown',
                    text,
                    time,
                  }),
                );
              }
            }
          }
        }
      });
      observer.observe(messagesRoot, { childList: true, subtree: true });
    });
  }
}
