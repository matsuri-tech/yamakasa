import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery();
// もし projectId や keyFilename をここで指定したい場合は：
// const bigquery = new BigQuery({ 
//   projectId: 'your-project-id', 
//   keyFilename: '/path/to/key.json' 
// });

export const db = {
  query: async (sql: string, params?: Record<string, any>) => {
    const [job] = await bigquery.createQueryJob({
      query: sql,
      params,
    });
    const [rows] = await job.getQueryResults();
    return rows;
  },
};
