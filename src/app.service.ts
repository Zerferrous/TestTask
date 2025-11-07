import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import puppeteer from 'puppeteer-extra';
import { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppService.name);
  private browser: Browser;
  private page: Page;
  constructor(private readonly configService: ConfigService) {}

  async onModuleDestroy() {
    await this.browser.close();
  }

  async onModuleInit() {
    this.logger.log('Инициализация Puppeteer.');
    this.browser = await puppeteer
      .use(StealthPlugin())
      .launch({ headless: false });
    this.page = await this.browser.newPage();

    this.logger.log('Переход на страницу авторизации...');
    try {
      await this.page.goto('https://www.avito.ru/#login?authsrc=h', {
        waitUntil: 'networkidle2',
        timeout: 0,
      });
    } catch {
      this.logger.error('Ошибка при переходе на страницу.');
    }

    this.logger.log('Ввод логина...');
    try {
      await this.page
        .locator('[data-marker="login-form/login/input"]')
        .fill(this.configService.getOrThrow<string>('AVITO_USERNAME'));
    } catch {
      this.logger.error('Ошибка при вводе логина.');
    }

    this.logger.log('Ввод пароля...');
    try {
      await this.page
        .locator('[data-marker="login-form/password/input"]')
        .fill(this.configService.getOrThrow<string>('AVITO_PASSWORD'));
    } catch {
      this.logger.error('Ошибка при вводе пароля.');
    }
    try {
      await this.page.locator('[data-marker="login-form/submit"]').click();
    } catch {
      this.logger.error('Ошибка при подтверждении ввода.');
    }

    try {
      await this.page.locator('[data-marker="header/menu-profile"]').wait();
      this.logger.log('Выполнен вход в аккаунт.');
    } catch {
      this.logger.error('Ошибка при входе в аккаунт.');
    }

    this.logger.log('Переход на страницу сообщений...');
    try {
      await this.page.goto('https://www.avito.ru/profile/messenger', {
        waitUntil: 'networkidle2',
        timeout: 0,
      });
    } catch {
      this.logger.error('Ошибка при переходе на страницу.');
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
    } catch {
      this.logger.error('Ошибка при открытии чата.');
    }

    this.logger.log('Слушает сообщения...');

    this.page.on('console', async (msg) => {
      try {
        const data = JSON.parse(msg.text());
        if (data.type === 'message') {
          this.logger.log(
            `Обнаружено новое сообщение: [${data.direction}] ${data.text}`,
          );
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
                    directionList: node.classList,
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
