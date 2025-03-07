import * as functions from '@google-cloud/functions-framework';
import express from 'express';  // 修正: デフォルトインポートを使用
import { main } from './main';  // main.tsからmain関数をインポート

const app = express();
app.use(express.json());

// /api/process エンドポイントで main 関数を呼び出し
app.post('/api/process', main);

functions.http('templateAPI', app);  // これがエントリーポイント