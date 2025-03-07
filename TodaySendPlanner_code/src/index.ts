// index.ts
import * as functions from '@google-cloud/functions-framework';
import { main } from './main';  // main.ts から main をインポート

functions.http('TodaySendPlanner_code', main);  // main を HTTP トリガーとして登録