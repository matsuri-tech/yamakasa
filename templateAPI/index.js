const express = require('express');
const { ReservationFetcher } = require('./services/reservationFetcher');
const { QueryGenerator } = require('./services/queryGenerator');
const { TemplateFetcher } = require('./services/templateFetcher');

const app = express();
app.use(express.json());

// サービスクラスのインスタンス
const reservationFetcher = new ReservationFetcher();
const queryGenerator = new QueryGenerator();
const templateFetcher = new TemplateFetcher();

app.post('/get-template', async (req, res) => {
  try {
    const { reservation_code } = req.body;
    if (!reservation_code) {
      return res.status(400).json({ error: 'reservation_code is required' });
    }

    // 1. 予約データを取得
    const reservationData = await reservationFetcher.fetch(reservation_code);
    if (!reservationData) {
      return res.status(404).json({ error: 'No reservation data found' });
    }

    // 2. 動的クエリを生成
    const { query, params } = queryGenerator.generate(reservationData);

    // 3. テンプレートを取得
    const template = await templateFetcher.fetch(query, params);
    if (!template) {
      return res.status(404).json({ error: 'No matching template found' });
    }

    // レスポンスを返却
    res.json(template);
  } catch (error) {
    console.error(`[ERROR]: ${error.message}`);
    res.status(500).json({ error: 'An unexpected error occurred.' });
  }
});

module.exports = app;
