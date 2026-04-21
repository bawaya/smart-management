import { test, expect } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';
import {
  createFlowClient,
  pickAvailableEquipment,
  createFlowWorker,
  createFlowDailyLog,
  generateInvoiceForClient,
  sendInvoiceByNumber,
  payInvoiceByNumber,
  cancelInvoiceByNumber,
  getInvoiceStatus,
  getDailyLogStatus,
} from '../utils/flow-helpers';
import { dateOffsetISO } from '../utils/finance-helpers';
import { confirmDailyLogByText } from '../utils/daily-log-helpers';

test.use({ storageState: storageStatePath('owner') });
// Each flow does 7+ sequential steps hitting prod — bump timeout well above default.
test.setTimeout(180_000);

test.describe('Flow A — Invoice Full Lifecycle', () => {
  test('complete flow: client → worker → log → confirm → invoice → send → payment → paid', async ({
    page,
  }) => {
    // Step 1: client
    const clientName = await createFlowClient(page, {
      equipment: '500',
      worker: '400',
    });
    console.log(`[A] ✓ Client: ${clientName}`);

    // Step 2: equipment (reuse)
    const equipmentName = await pickAvailableEquipment(page);
    console.log(`[A] ✓ Equipment: ${equipmentName}`);

    // Step 3: worker
    const workerName = await createFlowWorker(page, '400');
    console.log(`[A] ✓ Worker: ${workerName}`);

    // Step 4: daily-log
    await createFlowDailyLog(page, {
      clientName,
      equipmentName,
      workerName,
      equipmentRevenue: '500',
      workerRate: '400',
      workerRevenue: '400',
    });
    console.log(`[A] ✓ DailyLog created`);

    const draftLogStatus = await getDailyLogStatus(page, clientName);
    console.log(`[A]   daily-log status: ${draftLogStatus}`);
    expect(draftLogStatus.toLowerCase()).toMatch(/draft|טיוטה|مسودة/i);

    // Step 5: confirm daily-log
    const confirmResult = await confirmDailyLogByText(page, clientName);
    expect(
      confirmResult.status,
      `Confirm failed: ${confirmResult.message}`,
    ).not.toBe('error');
    console.log(`[A] ✓ DailyLog confirmed`);

    // Step 6: generate invoice
    const invoiceNumber = await generateInvoiceForClient(page, {
      clientName,
      periodStart: dateOffsetISO(-7),
      periodEnd: dateOffsetISO(7),
    });
    console.log(`[A] ✓ Invoice generated: ${invoiceNumber}`);

    const afterGenStatus = await getInvoiceStatus(page, invoiceNumber);
    console.log(`[A]   invoice status after gen: ${afterGenStatus}`);
    expect(afterGenStatus.toLowerCase()).toMatch(/draft|טיוטה/i);

    // Step 6.5: daily-log status now should be 'invoiced'
    const invoicedLogStatus = await getDailyLogStatus(page, clientName);
    console.log(`[A]   daily-log status after invoice: ${invoicedLogStatus}`);
    expect(invoicedLogStatus.toLowerCase()).toMatch(/invoiced|חשבונית/i);

    // Step 7: send invoice (draft → sent) — UI requires this before payment action
    const sendResult = await sendInvoiceByNumber(page, invoiceNumber);
    expect(sendResult.status, `Send failed: ${sendResult.message}`).not.toBe(
      'error',
    );
    console.log(`[A] ✓ Invoice sent`);

    const sentStatus = await getInvoiceStatus(page, invoiceNumber);
    console.log(`[A]   invoice status after send: ${sentStatus}`);
    expect(sentStatus.toLowerCase()).toMatch(/sent|נשלח/i);

    // Step 8: record full payment (500 + 400 = 900, plus VAT if applied)
    // Pay a generous amount to cover VAT-inclusive total.
    const paymentResult = await payInvoiceByNumber(page, invoiceNumber, '2000');
    expect(
      paymentResult.status,
      `Payment failed: ${paymentResult.message}`,
    ).not.toBe('error');
    console.log(`[A] ✓ Payment recorded`);

    // Step 9: verify invoice status → paid
    const finalStatus = await getInvoiceStatus(page, invoiceNumber);
    console.log(`[A] ✓ Final invoice status: ${finalStatus}`);
    expect(finalStatus.toLowerCase()).toMatch(/paid|שולמה|مدفوع/i);
  });
});

test.describe('Flow B — Invoice Cancellation + Rollback', () => {
  test('create invoice → cancel → daily-log returns to confirmed', async ({
    page,
  }) => {
    const clientName = await createFlowClient(page, {
      equipment: '300',
      worker: '200',
    });
    console.log(`[B] ✓ Client: ${clientName}`);

    const equipmentName = await pickAvailableEquipment(page);
    console.log(`[B] ✓ Equipment: ${equipmentName}`);

    const workerName = await createFlowWorker(page, '200');
    console.log(`[B] ✓ Worker: ${workerName}`);

    await createFlowDailyLog(page, {
      clientName,
      equipmentName,
      workerName,
      equipmentRevenue: '300',
      workerRate: '200',
      workerRevenue: '200',
    });
    console.log(`[B] ✓ DailyLog created`);

    const confirmResult = await confirmDailyLogByText(page, clientName);
    expect(confirmResult.status).not.toBe('error');
    console.log(`[B] ✓ DailyLog confirmed`);

    const invoiceNumber = await generateInvoiceForClient(page, {
      clientName,
      periodStart: dateOffsetISO(-7),
      periodEnd: dateOffsetISO(7),
    });
    console.log(`[B] ✓ Invoice generated: ${invoiceNumber}`);

    const beforeStatus = await getInvoiceStatus(page, invoiceNumber);
    console.log(`[B]   invoice before cancel: ${beforeStatus}`);
    expect(beforeStatus.toLowerCase()).not.toMatch(/cancelled|בוטל/i);

    // Cancel invoice (draft is cancellable per row action logic)
    const cancelResult = await cancelInvoiceByNumber(page, invoiceNumber);
    expect(
      cancelResult.status,
      `Cancel failed: ${cancelResult.message}`,
    ).not.toBe('error');
    console.log(`[B] ✓ Invoice cancelled`);

    // Verify invoice status = cancelled
    const afterCancelStatus = await getInvoiceStatus(page, invoiceNumber);
    console.log(`[B]   invoice after cancel: ${afterCancelStatus}`);
    expect(afterCancelStatus.toLowerCase()).toMatch(/cancelled|בוטל/i);

    // Verify daily-log rolled back to 'confirmed' (per actions.ts:367)
    const logStatusAfter = await getDailyLogStatus(page, clientName);
    console.log(`[B] ✓ daily-log after invoice cancel: ${logStatusAfter}`);
    expect(logStatusAfter.toLowerCase()).toMatch(/confirmed|מאושר|אישור/i);
  });
});
