import * as functions from '@google-cloud/functions-framework';
import { main } from './main';

// "app" (Expressアプリ) をHTTPトリガー関数として登録
functions.http('TodaySendPlanner_sendAPI', main);