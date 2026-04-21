/** بيانات ثابتة لاختبارات التقارير — كل الأرقام محسوبة يدوياً */
export const REPORT_SEED = {
  month: '2026-04',
  expenses: [
    { date: '2026-04-01', category: 'fuel',   amount: 1000, description: 'TEST_rpt_1' },
    { date: '2026-04-05', category: 'fuel',   amount: 500,  description: 'TEST_rpt_2' },
    { date: '2026-04-10', category: 'salary', amount: 5000, description: 'TEST_rpt_3' },
    { date: '2026-04-15', category: 'office', amount: 300,  description: 'TEST_rpt_4' },
  ],
  invoices: [
    { invoice_date: '2026-04-02', total: 3000, status: 'paid',    client_name: 'TEST_client_A' },
    { invoice_date: '2026-04-08', total: 2500, status: 'paid',    client_name: 'TEST_client_B' },
    { invoice_date: '2026-04-20', total: 1500, status: 'pending', client_name: 'TEST_client_C' },
  ],
  expected: {
    revenue: 5500,
    total_expenses: 6800,
    profit: -1300,
    fuel: 1500,
  },
};
