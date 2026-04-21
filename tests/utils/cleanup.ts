import { getClient } from './role-client.js';

/** يحذف كل البيانات اللي اسمها أو الوصف بيبدأ بـ TEST_ */
export async function cleanupTestData() {
  const owner = await getClient('owner');
  const endpoints = ['/api/equipment', '/api/vehicles', '/api/workers', '/api/expenses', '/api/invoices', '/api/daily-log'];

  for (const ep of endpoints) {
    const list = await owner.get<any[]>(ep);
    if (!Array.isArray(list.body)) continue;
    for (const item of list.body) {
      const label = item.name || item.description || item.full_name || item.plate_number || item.client_name || '';
      if (typeof label === 'string' && label.startsWith('TEST_')) {
        await owner.delete(`${ep}/${item.id}`);
      }
    }
  }
}
