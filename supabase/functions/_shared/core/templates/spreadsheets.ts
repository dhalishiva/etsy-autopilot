import { currency, theme } from '../spec/themes.ts';
import type { SpreadsheetSpec } from '../spec/types.ts';
import { brandParam, currencyParam, defaults, slug, spreadsheetGuide, themeParam } from './common.ts';
import type { Template } from './types.ts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ---------------------------------------------------------------------- */
/* GST invoice & expense kit (India)                                      */
/* ---------------------------------------------------------------------- */

const gstFields = [brandParam, themeParam('midnight')];

export const gstInvoiceKit: Template = {
  id: 'gst-invoice-expense-kit',
  name: 'GST Invoice & Expense Tracker',
  category: 'Finance',
  kind: 'spreadsheet',
  blurb: 'Indian small-business kit: GST invoices with CGST/SGST/IGST split, expenses with input tax credit, and a tax summary.',
  params: gstFields,
  suggestedPriceUsd: 9.5,
  build(raw): SpreadsheetSpec {
    const p = defaults(gstFields, raw);
    const name = 'GST Invoice & Expense Tracker';
    const spec: SpreadsheetSpec = {
      kind: 'spreadsheet',
      title: name,
      fileBase: slug(name),
      brand: p.brand || undefined,
      currency: currency('INR'),
      theme: theme(p.theme),
      sheets: [
        spreadsheetGuide(
          name,
          [
            {
              heading: 'How the GST split works',
              body: [
                'Choose "Intra-state" when your customer is in your state: GST is split equally into CGST and SGST.',
                'Choose "Inter-state" for customers in another state: the full amount goes to IGST.',
                'Enter the GST rate as a whole number (5, 18 …). The Summary tab totals what you collected and the input credit on expenses.',
                'This tracker is a record-keeping aid, not tax advice. Confirm rates and filings with your CA.',
              ],
            },
          ],
          p.brand,
        ),
        {
          kind: 'table',
          name: 'Invoices',
          title: 'Sales Invoices',
          subtitle: 'One row per invoice line. Status drives the Received / Outstanding totals.',
          rows: 300,
          columns: [
            { key: 'no', header: 'Invoice #', type: 'text', width: 12 },
            { key: 'date', header: 'Date', type: 'date' },
            { key: 'client', header: 'Client', type: 'text', width: 22 },
            { key: 'gstin', header: 'Client GSTIN', type: 'text', width: 18 },
            { key: 'desc', header: 'Description', type: 'text', width: 26 },
            { key: 'hsn', header: 'HSN / SAC', type: 'text', width: 11 },
            { key: 'qty', header: 'Qty', type: 'number', width: 7 },
            { key: 'rate', header: 'Rate', type: 'currency', width: 13 },
            { key: 'taxable', header: 'Taxable Value', type: 'formula', formula: 'IF([qty]="",0,[qty]*[rate])', resultFormat: 'currency' },
            { key: 'gst', header: 'GST %', type: 'select', options: ['0', '5', '18', '40'], width: 8 },
            { key: 'supply', header: 'Supply', type: 'select', options: ['Intra-state', 'Inter-state'], width: 13 },
            { key: 'cgst', header: 'CGST', type: 'formula', formula: 'IF([supply]="Intra-state",[taxable]*[gst]/200,0)', resultFormat: 'currency' },
            { key: 'sgst', header: 'SGST', type: 'formula', formula: 'IF([supply]="Intra-state",[taxable]*[gst]/200,0)', resultFormat: 'currency' },
            { key: 'igst', header: 'IGST', type: 'formula', formula: 'IF([supply]="Inter-state",[taxable]*[gst]/100,0)', resultFormat: 'currency' },
            { key: 'total', header: 'Invoice Total', type: 'formula', formula: '[taxable]+[cgst]+[sgst]+[igst]', resultFormat: 'currency' },
            { key: 'status', header: 'Status', type: 'select', options: ['Paid', 'Unpaid', 'Overdue'], width: 11 },
          ],
          sampleRows: [
            { no: 'INV-001', date: '2026-04-03', client: 'Sharma Traders', gstin: '07AABCS1429B1Z5', desc: 'Website design', hsn: '998314', qty: 1, rate: 25000, gst: '18', supply: 'Intra-state', status: 'Paid' },
            { no: 'INV-002', date: '2026-04-12', client: 'Patel Exports', gstin: '24AAGFP5512K1Z2', desc: 'Monthly SEO retainer', hsn: '998365', qty: 1, rate: 12000, gst: '18', supply: 'Inter-state', status: 'Unpaid' },
            { no: 'INV-003', date: '2026-04-18', client: 'Green Leaf Cafe', gstin: '07AAKFG7781L1Z9', desc: 'Menu design (pages)', hsn: '998391', qty: 4, rate: 1500, gst: '18', supply: 'Intra-state', status: 'Paid' },
            { no: 'INV-004', date: '2026-04-22', client: 'Mehta & Sons', gstin: '27AABCM3322P1Z4', desc: 'Product photography', hsn: '998383', qty: 20, rate: 450, gst: '18', supply: 'Inter-state', status: 'Overdue' },
            { no: 'INV-005', date: '2026-04-28', client: 'Sharma Traders', gstin: '07AABCS1429B1Z5', desc: 'Hosting & maintenance', hsn: '998315', qty: 1, rate: 3500, gst: '18', supply: 'Intra-state', status: 'Unpaid' },
          ],
          totals: { taxable: 'sum', cgst: 'sum', sgst: 'sum', igst: 'sum', total: 'sum' },
        },
        {
          kind: 'table',
          name: 'Expenses',
          title: 'Business Expenses',
          subtitle: 'Record the GST shown on each purchase bill to track input tax credit.',
          rows: 400,
          columns: [
            { key: 'date', header: 'Date', type: 'date' },
            { key: 'vendor', header: 'Vendor', type: 'text', width: 22 },
            { key: 'gstin', header: 'Vendor GSTIN', type: 'text', width: 18 },
            {
              key: 'category',
              header: 'Category',
              type: 'select',
              options: ['Rent', 'Software', 'Internet & Phone', 'Travel', 'Office Supplies', 'Marketing', 'Professional Fees', 'Salaries', 'Other'],
            },
            { key: 'desc', header: 'Description', type: 'text', width: 26 },
            { key: 'amount', header: 'Amount (excl. GST)', type: 'currency', width: 16 },
            { key: 'gstpaid', header: 'GST Paid (ITC)', type: 'currency', width: 15 },
            { key: 'total', header: 'Total Paid', type: 'formula', formula: 'N([amount])+N([gstpaid])', resultFormat: 'currency' },
            { key: 'mode', header: 'Paid Via', type: 'select', options: ['UPI', 'Bank Transfer', 'Card', 'Cash'] },
          ],
          sampleRows: [
            { date: '2026-04-05', vendor: 'CloudHost Pvt Ltd', gstin: '29AACCC1234D1Z1', category: 'Software', desc: 'Hosting plan', amount: 2000, gstpaid: 360, mode: 'Card' },
            { date: '2026-04-08', vendor: 'Office Mart', category: 'Office Supplies', desc: 'Printer paper', amount: 850, gstpaid: 42.5, mode: 'UPI' },
            { date: '2026-04-01', vendor: 'Sector 18 Spaces', gstin: '09AAACS5512Q1Z3', category: 'Rent', desc: 'Co-working desk', amount: 9000, gstpaid: 1620, mode: 'Bank Transfer' },
            { date: '2026-04-10', vendor: 'FiberNet', category: 'Internet & Phone', desc: 'Broadband', amount: 999, gstpaid: 179.82, mode: 'UPI' },
            { date: '2026-04-15', vendor: 'AdReach', category: 'Marketing', desc: 'Social ads', amount: 3000, gstpaid: 540, mode: 'Card' },
            { date: '2026-04-20', vendor: 'R. Gupta & Co', category: 'Professional Fees', desc: 'Monthly accounting', amount: 2500, gstpaid: 450, mode: 'Bank Transfer' },
          ],
          totals: { amount: 'sum', gstpaid: 'sum', total: 'sum' },
        },
        {
          kind: 'summary',
          name: 'Summary',
          title: 'GST & Profit Summary',
          subtitle: 'Updates automatically from the Invoices and Expenses tabs.',
          metrics: [
            { label: 'Taxable sales', formula: 'SUM({{Invoices.taxable}})', format: 'currency' },
            { label: 'GST collected', formula: 'SUM({{Invoices.cgst}})+SUM({{Invoices.sgst}})+SUM({{Invoices.igst}})', format: 'currency', hint: 'CGST + SGST + IGST on sales' },
            { label: 'Input tax credit', formula: 'SUM({{Expenses.gstpaid}})', format: 'currency', hint: 'GST paid on business purchases' },
            { label: 'Net GST payable', formula: 'MAX(0,C5-C6)', format: 'currency', hint: 'Collected minus input credit' },
            { label: 'Received', formula: 'SUMIF({{Invoices.status}},"Paid",{{Invoices.total}})', format: 'currency' },
            { label: 'Outstanding', formula: 'SUM({{Invoices.total}})-C8', format: 'currency', hint: 'Unpaid + overdue invoices' },
            { label: 'Expenses (excl. GST)', formula: 'SUM({{Expenses.amount}})', format: 'currency' },
            { label: 'Profit before tax', formula: 'C4-C10', format: 'currency', hint: 'Taxable sales minus expenses' },
          ],
          breakdowns: [
            {
              title: 'Expenses by category',
              categories: ['Rent', 'Software', 'Internet & Phone', 'Travel', 'Office Supplies', 'Marketing', 'Professional Fees', 'Salaries', 'Other'],
              valueFormula: 'SUMIF({{Expenses.category}},{label},{{Expenses.amount}})',
              format: 'currency',
              valueHeader: 'Spent',
              dataBar: true,
            },
          ],
        },
      ],
    };
    return spec;
  },
  seed() {
    return {
      productName: 'GST Invoice and Expense Tracker',
      format: 'Excel & Google Sheets template',
      audience: 'Indian freelancers, consultants and small businesses',
      keywords: [
        'gst invoice template',
        'gst tracker',
        'expense tracker',
        'invoice spreadsheet',
        'india small business',
        'freelancer invoice',
        'excel template',
        'google sheets',
        'bookkeeping',
        'tax tracker',
        'income tracker',
        'business finance',
        'cgst sgst igst',
        'accounting sheet',
      ],
      features: [
        'Automatic CGST / SGST / IGST split for intra- and inter-state sales',
        'Input tax credit tracking on every expense',
        'Live summary: GST payable, received, outstanding and profit',
        'Expense breakdown by category with in-cell bars',
        'Dropdowns for GST rate, supply type, status and payment mode',
      ],
      includes: ['1 Excel workbook (.xlsx) with 4 tabs: Start Here, Invoices, Expenses, Summary', 'Works in Google Sheets, Excel and Numbers'],
      howItWorks: ['Download the file after purchase', 'Open in Excel or upload to Google Sheets', 'Delete the example rows and start entering invoices'],
    };
  },
};

/* ---------------------------------------------------------------------- */
/* Freelancer dashboard                                                   */
/* ---------------------------------------------------------------------- */

const freelancerFields = [brandParam, themeParam('ocean'), currencyParam('USD')];

export const freelancerDashboard: Template = {
  id: 'freelancer-dashboard',
  name: 'Freelancer Business Dashboard',
  category: 'Business',
  kind: 'spreadsheet',
  blurb: 'Clients, time log, invoices and a monthly earnings dashboard for solo freelancers.',
  params: freelancerFields,
  suggestedPriceUsd: 12,
  build(raw): SpreadsheetSpec {
    const p = defaults(freelancerFields, raw);
    const name = 'Freelancer Business Dashboard';
    return {
      kind: 'spreadsheet',
      title: name,
      fileBase: slug(name),
      brand: p.brand || undefined,
      currency: currency(p.currency),
      theme: theme(p.theme),
      sheets: [
        spreadsheetGuide(
          name,
          [
            {
              heading: 'Your weekly routine',
              body: [
                'Log every working session in Time Log — hours × rate becomes your earnings automatically.',
                'Tick “Billed” once a session is on an invoice, so nothing slips through.',
                'Add each invoice to the Invoices tab and update its status when paid. The Dashboard shows what is still owed.',
              ],
            },
          ],
          p.brand,
        ),
        {
          kind: 'table',
          name: 'Clients',
          title: 'Clients',
          rows: 100,
          columns: [
            { key: 'name', header: 'Client', type: 'text', width: 24 },
            { key: 'contact', header: 'Contact Person', type: 'text', width: 20 },
            { key: 'email', header: 'Email', type: 'text', width: 28 },
            { key: 'rate', header: 'Hourly Rate', type: 'currency' },
            { key: 'status', header: 'Status', type: 'select', options: ['Active', 'Paused', 'Past'] },
            { key: 'notes', header: 'Notes', type: 'text', width: 34 },
          ],
          sampleRows: [
            { name: 'Acme Studio', contact: 'Jordan Lee', email: 'jordan@acme.example', rate: 60, status: 'Active' },
            { name: 'Brightside Co', contact: 'Priya Nair', email: 'priya@brightside.example', rate: 75, status: 'Active' },
            { name: 'Northwind Labs', contact: 'Sam Ortiz', email: 'sam@northwind.example', rate: 55, status: 'Paused' },
          ],
        },
        {
          kind: 'table',
          name: 'Time Log',
          title: 'Time Log',
          subtitle: 'One row per work session.',
          rows: 500,
          columns: [
            { key: 'date', header: 'Date', type: 'date' },
            { key: 'client', header: 'Client', type: 'text', width: 22 },
            { key: 'project', header: 'Project / Task', type: 'text', width: 30 },
            { key: 'hours', header: 'Hours', type: 'number', width: 9 },
            { key: 'rate', header: 'Rate', type: 'currency' },
            { key: 'amount', header: 'Amount', type: 'formula', formula: 'N([hours])*N([rate])', resultFormat: 'currency' },
            { key: 'billed', header: 'Billed', type: 'checkbox' },
          ],
          sampleRows: [
            { date: '2026-01-06', client: 'Acme Studio', project: 'Homepage redesign', hours: 3.5, rate: 60, billed: '✓' },
            { date: '2026-01-08', client: 'Acme Studio', project: 'Revisions', hours: 1.5, rate: 60 },
            { date: '2026-01-12', client: 'Brightside Co', project: 'Brand guidelines', hours: 4, rate: 75, billed: '✓' },
            { date: '2026-01-14', client: 'Brightside Co', project: 'Logo variations', hours: 2.5, rate: 75, billed: '✓' },
            { date: '2026-01-20', client: 'Northwind Labs', project: 'Landing page copy', hours: 3, rate: 55 },
            { date: '2026-02-03', client: 'Acme Studio', project: 'Blog templates', hours: 5, rate: 60 },
            { date: '2026-02-09', client: 'Brightside Co', project: 'Social media kit', hours: 6, rate: 75 },
            { date: '2026-02-17', client: 'Acme Studio', project: 'Client call + planning', hours: 1, rate: 60 },
          ],
          totals: { hours: 'sum', amount: 'sum' },
        },
        {
          kind: 'table',
          name: 'Invoices',
          title: 'Invoices',
          rows: 200,
          columns: [
            { key: 'no', header: 'Invoice #', type: 'text', width: 12 },
            { key: 'client', header: 'Client', type: 'text', width: 22 },
            { key: 'issued', header: 'Issued', type: 'date' },
            { key: 'due', header: 'Due', type: 'date' },
            { key: 'amount', header: 'Amount', type: 'currency' },
            { key: 'status', header: 'Status', type: 'select', options: ['Draft', 'Sent', 'Paid', 'Overdue'] },
            {
              key: 'late',
              header: 'Days Overdue',
              type: 'formula',
              formula: 'IF(AND([status]<>"Paid",N([due])>0,TODAY()>[due]),TODAY()-[due],0)',
              resultFormat: 'number',
            },
          ],
          sampleRows: [
            { no: '2026-001', client: 'Acme Studio', issued: '2026-01-10', due: '2026-01-24', amount: 300, status: 'Paid' },
            { no: '2026-002', client: 'Brightside Co', issued: '2026-01-31', due: '2026-02-14', amount: 487.5, status: 'Paid' },
            { no: '2026-003', client: 'Northwind Labs', issued: '2026-02-01', due: '2026-02-15', amount: 165, status: 'Sent' },
          ],
          totals: { amount: 'sum' },
        },
        {
          kind: 'summary',
          name: 'Dashboard',
          title: 'Business Dashboard',
          subtitle: 'Everything updates from your Time Log and Invoices.',
          metrics: [
            { label: 'Hours logged', formula: 'SUM({{Time Log.hours}})', format: 'number' },
            { label: 'Earned', formula: 'SUM({{Time Log.amount}})', format: 'currency', hint: 'Hours × rate' },
            { label: 'Not yet billed', formula: 'SUMIF({{Time Log.billed}},"<>✓",{{Time Log.amount}})', format: 'currency', hint: 'Work you still need to invoice' },
            { label: 'Paid', formula: 'SUMIF({{Invoices.status}},"Paid",{{Invoices.amount}})', format: 'currency' },
            { label: 'Outstanding', formula: 'SUM({{Invoices.amount}})-C7', format: 'currency', hint: 'Sent, draft and overdue invoices' },
            { label: 'Effective hourly rate', formula: 'IFERROR(C5/C4,0)', format: 'currency' },
            { label: 'Active clients', formula: 'COUNTIF({{Clients.status}},"Active")', format: 'number' },
          ],
          breakdowns: [
            {
              title: 'Earnings by month',
              categories: MONTHS,
              labelHeader: 'Month',
              valueFormula: 'SUMPRODUCT(ISNUMBER({{Time Log.date}})*(MONTH({{Time Log.date}})=MATCH({label},{"Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"},0))*{{Time Log.amount}})',
              format: 'currency',
              valueHeader: 'Earned',
              secondary: {
                header: 'Hours',
                valueFormula: 'SUMPRODUCT(ISNUMBER({{Time Log.date}})*(MONTH({{Time Log.date}})=MATCH({label},{"Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"},0))*{{Time Log.hours}})',
                format: 'number',
              },
              dataBar: true,
            },
          ],
        },
      ],
    };
  },
  seed() {
    return {
      productName: 'Freelancer Business Dashboard',
      format: 'Excel & Google Sheets template',
      audience: 'freelancers, consultants, designers and developers',
      keywords: [
        'freelancer template',
        'freelance tracker',
        'time tracker',
        'invoice tracker',
        'client tracker',
        'small business',
        'google sheets',
        'excel template',
        'income tracker',
        'business planner',
        'hourly tracker',
        'side hustle',
        'self employed',
        'dashboard template',
      ],
      features: [
        'Time log that calculates earnings from hours × rate',
        '“Not yet billed” tracker so no work goes uninvoiced',
        'Invoice list with automatic days-overdue counter',
        'Dashboard with earnings by month and effective hourly rate',
        'Choose your currency and colour theme',
      ],
      includes: ['1 Excel workbook (.xlsx) with 5 tabs', 'Works in Google Sheets, Excel and Numbers'],
      howItWorks: ['Download the file after purchase', 'Open in Excel or upload to Google Sheets', 'Add your clients and start logging time'],
    };
  },
};

/* ---------------------------------------------------------------------- */
/* Wedding budget & guest planner                                         */
/* ---------------------------------------------------------------------- */

const weddingFields = [brandParam, themeParam('blush'), currencyParam('USD')];
const WEDDING_CATS = ['Venue', 'Catering', 'Attire', 'Photography', 'Decor & Flowers', 'Music & Entertainment', 'Invitations', 'Rings & Jewellery', 'Beauty', 'Transport', 'Gifts & Favours', 'Other'];

export const weddingPlanner: Template = {
  id: 'wedding-budget-planner',
  name: 'Wedding Budget & Guest Planner',
  category: 'Events',
  kind: 'spreadsheet',
  blurb: 'Budget vs actual by category, payments due, guest list with RSVPs and meals, and vendor contacts.',
  params: weddingFields,
  suggestedPriceUsd: 10,
  build(raw): SpreadsheetSpec {
    const p = defaults(weddingFields, raw);
    const name = 'Wedding Budget & Guest Planner';
    return {
      kind: 'spreadsheet',
      title: name,
      fileBase: slug(name),
      brand: p.brand || undefined,
      currency: currency(p.currency),
      theme: theme(p.theme),
      sheets: [
        spreadsheetGuide(
          name,
          [
            {
              heading: 'Planning tips',
              body: [
                'Start on the Overview tab: type your total budget into the first box. Everything else measures against it.',
                'In Budget, enter the estimate first, then the actual cost once booked, then what you have paid so far.',
                'Guest List counts each invitation’s guests (e.g. 2 for a couple) and totals RSVPs and meal choices.',
              ],
            },
          ],
          p.brand,
        ),
        {
          kind: 'summary',
          name: 'Overview',
          title: 'Wedding Overview',
          subtitle: 'Type your total budget in the first box — the rest is automatic.',
          metrics: [
            { label: 'Total budget', formula: '25000', format: 'currency', hint: '← Type your total budget here' },
            { label: 'Estimated cost', formula: 'SUM({{Budget.estimate}})', format: 'currency' },
            { label: 'Actual cost', formula: 'SUM({{Budget.actual}})', format: 'currency' },
            { label: 'Left to spend', formula: 'C4-C6', format: 'currency', hint: 'Budget minus actual cost' },
            { label: 'Paid so far', formula: 'SUM({{Budget.paid}})', format: 'currency' },
            { label: 'Still to pay', formula: 'SUM({{Budget.due}})', format: 'currency' },
            { label: 'Guests invited', formula: 'SUM({{Guest List.count}})', format: 'number' },
            { label: 'Attending', formula: 'SUMIF({{Guest List.rsvp}},"Attending",{{Guest List.count}})', format: 'number' },
          ],
          breakdowns: [
            {
              title: 'Budget by category',
              categories: WEDDING_CATS,
              valueFormula: 'SUMIF({{Budget.category}},{label},{{Budget.actual}})',
              valueHeader: 'Actual',
              format: 'currency',
              secondary: { header: 'Estimate', valueFormula: 'SUMIF({{Budget.category}},{label},{{Budget.estimate}})', format: 'currency' },
              dataBar: true,
            },
            {
              title: 'Meal choices (attending guests)',
              categories: ['Standard', 'Vegetarian', 'Vegan', 'Kids', 'Other'],
              labelHeader: 'Meal',
              valueFormula: 'SUMIFS({{Guest List.count}},{{Guest List.meal}},{label},{{Guest List.rsvp}},"Attending")',
              valueHeader: 'Guests',
              format: 'number',
            },
          ],
        },
        {
          kind: 'table',
          name: 'Budget',
          title: 'Budget & Payments',
          rows: 150,
          columns: [
            { key: 'category', header: 'Category', type: 'select', options: WEDDING_CATS, width: 20 },
            { key: 'item', header: 'Item', type: 'text', width: 26 },
            { key: 'vendor', header: 'Vendor', type: 'text', width: 20 },
            { key: 'estimate', header: 'Estimate', type: 'currency' },
            { key: 'actual', header: 'Actual', type: 'currency' },
            { key: 'paid', header: 'Paid', type: 'currency' },
            { key: 'due', header: 'Balance Due', type: 'formula', formula: 'MAX(0,N([actual])-N([paid]))', resultFormat: 'currency' },
            { key: 'duedate', header: 'Due Date', type: 'date' },
            { key: 'status', header: 'Status', type: 'select', options: ['Researching', 'Booked', 'Deposit Paid', 'Paid in Full'] },
          ],
          sampleRows: [
            { category: 'Venue', item: 'Reception hall', vendor: 'Rosewood Manor', estimate: 8000, actual: 8500, paid: 2000, duedate: '2026-05-01', status: 'Deposit Paid' },
            { category: 'Photography', item: 'Full-day package', vendor: 'Golden Hour Co', estimate: 2500, actual: 2400, paid: 2400, status: 'Paid in Full' },
            { category: 'Catering', item: 'Dinner for 120', vendor: 'Saffron Table', estimate: 6000, actual: 6600, paid: 1500, duedate: '2026-05-10', status: 'Deposit Paid' },
            { category: 'Attire', item: 'Dress + alterations', vendor: 'Ivory Lane', estimate: 1800, actual: 1650, paid: 1650, status: 'Paid in Full' },
            { category: 'Decor & Flowers', item: 'Centrepieces + arch', vendor: 'Petal & Stem', estimate: 1500, actual: 1700, paid: 500, duedate: '2026-05-01', status: 'Deposit Paid' },
            { category: 'Music & Entertainment', item: 'DJ (5 hours)', vendor: 'Sound Story', estimate: 1200, actual: 1100, paid: 300, duedate: '2026-04-20', status: 'Booked' },
            { category: 'Invitations', item: 'Printed suite', vendor: 'Paper Moon', estimate: 400, actual: 380, paid: 380, status: 'Paid in Full' },
          ],
          totals: { estimate: 'sum', actual: 'sum', paid: 'sum', due: 'sum' },
        },
        {
          kind: 'table',
          name: 'Guest List',
          title: 'Guest List',
          rows: 400,
          columns: [
            { key: 'name', header: 'Guest / Household', type: 'text', width: 26 },
            { key: 'side', header: 'Side', type: 'select', options: ['Partner 1', 'Partner 2', 'Both'] },
            { key: 'group', header: 'Group', type: 'select', options: ['Family', 'Friends', 'Work', 'Plus-one'] },
            { key: 'count', header: 'Guests', type: 'number', width: 8 },
            { key: 'address', header: 'Address / Email', type: 'text', width: 30 },
            { key: 'rsvp', header: 'RSVP', type: 'select', options: ['Awaiting', 'Attending', 'Declined'] },
            { key: 'meal', header: 'Meal', type: 'select', options: ['Standard', 'Vegetarian', 'Vegan', 'Kids', 'Other'] },
            { key: 'table', header: 'Table', type: 'text', width: 8 },
            { key: 'gift', header: 'Gift', type: 'checkbox' },
            { key: 'thanks', header: 'Thank-you Sent', type: 'checkbox', width: 10 },
          ],
          sampleRows: [
            { name: 'The Rivera family', side: 'Partner 1', group: 'Family', count: 4, rsvp: 'Attending', meal: 'Standard', table: '3' },
            { name: 'Sam Okafor', side: 'Partner 2', group: 'Friends', count: 1, rsvp: 'Awaiting' },
            { name: 'Aunt Meera & Raj', side: 'Partner 2', group: 'Family', count: 2, rsvp: 'Attending', meal: 'Vegetarian', table: '2', gift: '✓' },
            { name: 'Chen household', side: 'Both', group: 'Friends', count: 3, rsvp: 'Attending', meal: 'Standard', table: '5' },
            { name: 'Lucy Hart', side: 'Partner 1', group: 'Work', count: 1, rsvp: 'Declined', gift: '✓', thanks: '✓' },
            { name: 'The Kowalskis', side: 'Partner 1', group: 'Family', count: 4, rsvp: 'Attending', meal: 'Kids', table: '3' },
          ],
          totals: { count: 'sum' },
        },
        {
          kind: 'table',
          name: 'Vendors',
          title: 'Vendor Contacts',
          rows: 60,
          columns: [
            { key: 'vendor', header: 'Vendor', type: 'text', width: 22 },
            { key: 'service', header: 'Service', type: 'select', options: WEDDING_CATS, width: 20 },
            { key: 'contact', header: 'Contact', type: 'text', width: 18 },
            { key: 'phone', header: 'Phone', type: 'text', width: 16 },
            { key: 'email', header: 'Email', type: 'text', width: 26 },
            { key: 'quote', header: 'Quote', type: 'currency' },
            { key: 'booked', header: 'Booked', type: 'checkbox' },
            { key: 'notes', header: 'Notes', type: 'text', width: 30 },
          ],
        },
      ],
    };
  },
  seed() {
    return {
      productName: 'Wedding Budget and Guest List Planner',
      format: 'Excel & Google Sheets template',
      audience: 'engaged couples and wedding planners',
      keywords: [
        'wedding budget',
        'wedding planner',
        'guest list template',
        'wedding spreadsheet',
        'rsvp tracker',
        'wedding checklist',
        'budget planner',
        'google sheets',
        'excel template',
        'bride to be gift',
        'engagement gift',
        'wedding organizer',
        'vendor tracker',
        'seating planner',
      ],
      features: [
        'Budget vs actual for 12 wedding categories with in-cell bars',
        'Payment tracker with balance due and due dates',
        'Guest list with RSVP, meal choice, table and thank-you tracking',
        'Overview dashboard: left to spend, still to pay, guests attending',
        'Vendor contact sheet with quotes and booking status',
      ],
      includes: ['1 Excel workbook (.xlsx) with 5 tabs', 'Works in Google Sheets, Excel and Numbers'],
      howItWorks: ['Download the file after purchase', 'Open in Excel or upload to Google Sheets', 'Type your total budget on the Overview tab and start planning'],
    };
  },
};

/* ---------------------------------------------------------------------- */
/* Job hunt tracker                                                       */
/* ---------------------------------------------------------------------- */

const jobFields = [brandParam, themeParam('terracotta')];
const JOB_STATUS = ['Applied', 'Screening', 'Interview', 'Final Round', 'Offer', 'Rejected', 'No Response'];
const JOB_SOURCES = ['LinkedIn', 'Company Site', 'Referral', 'Recruiter', 'Job Board', 'Other'];

export const jobHuntTracker: Template = {
  id: 'job-hunt-tracker',
  name: 'Job Search Tracker',
  category: 'Career',
  kind: 'spreadsheet',
  blurb: 'Applications pipeline, follow-up reminders, interview prep bank and networking contacts.',
  params: jobFields,
  suggestedPriceUsd: 7,
  build(raw): SpreadsheetSpec {
    const p = defaults(jobFields, raw);
    const name = 'Job Search Tracker';
    return {
      kind: 'spreadsheet',
      title: name,
      fileBase: slug(name),
      brand: p.brand || undefined,
      currency: currency('USD'),
      theme: theme(p.theme),
      sheets: [
        spreadsheetGuide(
          name,
          [
            {
              heading: 'Make it a habit',
              body: [
                'Add every application the day you send it. “Days Since” turns orange-worthy when you should follow up (7+ days).',
                'Keep your interview stories in Interview Prep using the STAR format: Situation, Task, Action, Result.',
                'The Insights tab shows which sources actually lead to interviews — spend more time there.',
              ],
            },
          ],
          p.brand,
        ),
        {
          kind: 'table',
          name: 'Applications',
          title: 'Applications',
          rows: 300,
          columns: [
            { key: 'date', header: 'Applied', type: 'date' },
            { key: 'company', header: 'Company', type: 'text', width: 22 },
            { key: 'role', header: 'Role', type: 'text', width: 26 },
            { key: 'location', header: 'Location', type: 'text', width: 16 },
            { key: 'source', header: 'Source', type: 'select', options: JOB_SOURCES },
            { key: 'link', header: 'Job Link', type: 'text', width: 24 },
            { key: 'salary', header: 'Salary Range', type: 'text', width: 16 },
            { key: 'status', header: 'Status', type: 'select', options: JOB_STATUS, width: 14 },
            { key: 'next', header: 'Next Step', type: 'text', width: 24 },
            {
              key: 'days',
              header: 'Days Since',
              type: 'formula',
              formula: 'IF(N([date])=0,0,MAX(0,TODAY()-[date]))',
              resultFormat: 'number',
              note: 'Follow up if 7+ days with no response',
            },
            {
              key: 'followup',
              header: 'Follow Up?',
              type: 'formula',
              formula: 'IF(AND([days]>=7,OR([status]="Applied",[status]="Screening")),"Follow up","")',
              resultFormat: 'text',
            },
          ],
          sampleRows: [
            { date: '2026-02-01', company: 'Northwind', role: 'Product Analyst', location: 'Remote', source: 'LinkedIn', status: 'Interview', next: 'Panel interview Tue' },
            { date: '2026-02-03', company: 'Contoso', role: 'Data Analyst', location: 'Bengaluru', source: 'Referral', status: 'Applied' },
            { date: '2026-02-05', company: 'Fabrikam', role: 'BI Developer', location: 'Pune', source: 'Company Site', status: 'Screening', next: 'Recruiter call Thu' },
            { date: '2026-02-07', company: 'Tailspin', role: 'Analytics Lead', location: 'Remote', source: 'Recruiter', status: 'Rejected' },
            { date: '2026-02-10', company: 'Adatum', role: 'Product Analyst', location: 'Noida', source: 'LinkedIn', status: 'No Response' },
            { date: '2026-02-12', company: 'Litware', role: 'Data Analyst II', location: 'Gurugram', source: 'Job Board', status: 'Final Round', next: 'Case study due Mon' },
          ],
        },
        {
          kind: 'table',
          name: 'Interview Prep',
          title: 'Interview Prep Bank',
          rows: 120,
          columns: [
            { key: 'question', header: 'Question', type: 'text', width: 36 },
            { key: 'category', header: 'Category', type: 'select', options: ['Behavioural', 'Technical', 'Role-specific', 'About the company', 'Questions to ask'] },
            { key: 'answer', header: 'My Answer (STAR)', type: 'text', width: 60 },
            { key: 'practiced', header: 'Practised', type: 'checkbox', width: 10 },
          ],
          sampleRows: [
            { question: 'Tell me about a time you handled a conflict.', category: 'Behavioural' },
            { question: 'Why do you want to work here?', category: 'About the company' },
            { question: 'What does success look like in the first 90 days?', category: 'Questions to ask' },
          ],
        },
        {
          kind: 'table',
          name: 'Contacts',
          title: 'Networking Contacts',
          rows: 150,
          columns: [
            { key: 'name', header: 'Name', type: 'text', width: 20 },
            { key: 'company', header: 'Company', type: 'text', width: 20 },
            { key: 'role', header: 'Role', type: 'text', width: 20 },
            { key: 'profile', header: 'Profile Link', type: 'text', width: 26 },
            { key: 'last', header: 'Last Contact', type: 'date' },
            { key: 'notes', header: 'Notes', type: 'text', width: 34 },
          ],
        },
        {
          kind: 'summary',
          name: 'Insights',
          title: 'Job Search Insights',
          metrics: [
            { label: 'Applications sent', formula: 'COUNTA({{Applications.company}})', format: 'number' },
            {
              label: 'Interviews',
              formula: 'COUNTIF({{Applications.status}},"Interview")+COUNTIF({{Applications.status}},"Final Round")+COUNTIF({{Applications.status}},"Offer")',
              format: 'number',
            },
            { label: 'Offers', formula: 'COUNTIF({{Applications.status}},"Offer")', format: 'number' },
            { label: 'Interview rate', formula: 'IFERROR(C5/C4,0)', format: 'percent', hint: 'Applications that reached interview' },
            { label: 'Need a follow-up', formula: 'COUNTIF({{Applications.followup}},"Follow up")', format: 'number' },
          ],
          breakdowns: [
            {
              title: 'Pipeline by status',
              categories: JOB_STATUS,
              labelHeader: 'Status',
              valueFormula: 'COUNTIF({{Applications.status}},{label})',
              valueHeader: 'Applications',
              format: 'number',
              dataBar: true,
            },
            {
              title: 'Where applications come from',
              categories: JOB_SOURCES,
              labelHeader: 'Source',
              valueFormula: 'COUNTIF({{Applications.source}},{label})',
              valueHeader: 'Applications',
              format: 'number',
              secondary: {
                header: 'Reached interview',
                valueFormula:
                  'COUNTIFS({{Applications.source}},{label},{{Applications.status}},"Interview")+COUNTIFS({{Applications.source}},{label},{{Applications.status}},"Final Round")+COUNTIFS({{Applications.source}},{label},{{Applications.status}},"Offer")',
                format: 'number',
              },
            },
          ],
        },
      ],
    };
  },
  seed() {
    return {
      productName: 'Job Search Tracker',
      format: 'Excel & Google Sheets template',
      audience: 'job seekers, graduates and career changers',
      keywords: [
        'job search tracker',
        'job application',
        'job tracker',
        'career planner',
        'interview prep',
        'job hunt template',
        'google sheets',
        'excel template',
        'resume companion',
        'graduate gift',
        'career change',
        'networking tracker',
        'job seeker',
        'application log',
      ],
      features: [
        'Application pipeline with status dropdowns',
        'Automatic “days since” counter and follow-up flags',
        'Interview prep bank using the STAR method',
        'Networking contact log',
        'Insights: interview rate and which sources work best',
      ],
      includes: ['1 Excel workbook (.xlsx) with 5 tabs', 'Works in Google Sheets, Excel and Numbers'],
      howItWorks: ['Download the file after purchase', 'Open in Excel or upload to Google Sheets', 'Log each application as you send it'],
    };
  },
};

/* ---------------------------------------------------------------------- */
/* Personal budget & savings                                              */
/* ---------------------------------------------------------------------- */

const budgetFields = [brandParam, themeParam('sage'), currencyParam('USD')];
const BUDGET_CATS = ['Housing', 'Utilities', 'Groceries', 'Transport', 'Eating Out', 'Health', 'Insurance', 'Subscriptions', 'Shopping', 'Entertainment', 'Debt Payments', 'Gifts & Giving', 'Other'];

export const personalBudget: Template = {
  id: 'personal-budget-planner',
  name: 'Personal Budget & Savings Planner',
  category: 'Finance',
  kind: 'spreadsheet',
  blurb: 'Income, spending by category, monthly cash flow and savings goals with progress tracking.',
  params: budgetFields,
  suggestedPriceUsd: 8,
  build(raw): SpreadsheetSpec {
    const p = defaults(budgetFields, raw);
    const name = 'Personal Budget & Savings Planner';
    return {
      kind: 'spreadsheet',
      title: name,
      fileBase: slug(name),
      brand: p.brand || undefined,
      currency: currency(p.currency),
      theme: theme(p.theme),
      sheets: [
        spreadsheetGuide(
          name,
          [
            {
              heading: 'How to use it',
              body: [
                'Add income as it arrives and every purchase in Spending (a quick weekly catch-up works well).',
                'The Overview shows where your money went this year and month by month.',
                'Set goals in Savings Goals — progress updates as you increase “Saved so far”.',
              ],
            },
          ],
          p.brand,
        ),
        {
          kind: 'table',
          name: 'Income',
          title: 'Income',
          rows: 200,
          columns: [
            { key: 'date', header: 'Date', type: 'date' },
            { key: 'source', header: 'Source', type: 'text', width: 24 },
            { key: 'type', header: 'Type', type: 'select', options: ['Salary', 'Freelance', 'Business', 'Investment', 'Gift', 'Other'] },
            { key: 'amount', header: 'Amount', type: 'currency' },
            { key: 'notes', header: 'Notes', type: 'text', width: 30 },
          ],
          sampleRows: [
            { date: '2026-01-01', source: 'Monthly salary', type: 'Salary', amount: 4200 },
            { date: '2026-01-18', source: 'Design side project', type: 'Freelance', amount: 650 },
            { date: '2026-02-01', source: 'Monthly salary', type: 'Salary', amount: 4200 },
          ],
          totals: { amount: 'sum' },
        },
        {
          kind: 'table',
          name: 'Spending',
          title: 'Spending',
          rows: 800,
          columns: [
            { key: 'date', header: 'Date', type: 'date' },
            { key: 'category', header: 'Category', type: 'select', options: BUDGET_CATS, width: 18 },
            { key: 'desc', header: 'Description', type: 'text', width: 28 },
            { key: 'amount', header: 'Amount', type: 'currency' },
            { key: 'method', header: 'Paid With', type: 'select', options: ['Debit Card', 'Credit Card', 'Cash', 'UPI / Wallet', 'Bank Transfer'] },
            { key: 'need', header: 'Need / Want', type: 'select', options: ['Need', 'Want'] },
          ],
          sampleRows: [
            { date: '2026-01-02', category: 'Housing', desc: 'Rent', amount: 1400, method: 'Bank Transfer', need: 'Need' },
            { date: '2026-01-04', category: 'Groceries', desc: 'Weekly shop', amount: 86.4, method: 'Debit Card', need: 'Need' },
            { date: '2026-01-05', category: 'Eating Out', desc: 'Dinner with friends', amount: 42, method: 'Credit Card', need: 'Want' },
            { date: '2026-01-07', category: 'Utilities', desc: 'Electricity', amount: 96.2, method: 'Bank Transfer', need: 'Need' },
            { date: '2026-01-09', category: 'Transport', desc: 'Monthly transit pass', amount: 110, method: 'Debit Card', need: 'Need' },
            { date: '2026-01-12', category: 'Subscriptions', desc: 'Streaming + music', amount: 24.98, method: 'Credit Card', need: 'Want' },
            { date: '2026-01-15', category: 'Groceries', desc: 'Weekly shop', amount: 92.15, method: 'Debit Card', need: 'Need' },
            { date: '2026-01-20', category: 'Health', desc: 'Gym membership', amount: 45, method: 'Credit Card', need: 'Need' },
            { date: '2026-02-02', category: 'Housing', desc: 'Rent', amount: 1400, method: 'Bank Transfer', need: 'Need' },
          ],
          totals: { amount: 'sum' },
        },
        {
          kind: 'table',
          name: 'Savings Goals',
          title: 'Savings Goals',
          rows: 20,
          columns: [
            { key: 'goal', header: 'Goal', type: 'text', width: 26 },
            { key: 'target', header: 'Target', type: 'currency' },
            { key: 'saved', header: 'Saved So Far', type: 'currency' },
            { key: 'progress', header: 'Progress', type: 'formula', formula: 'IF(N([target])=0,0,MIN(1,N([saved])/[target]))', resultFormat: 'percent' },
            { key: 'left', header: 'Still Needed', type: 'formula', formula: 'MAX(0,N([target])-N([saved]))', resultFormat: 'currency' },
            { key: 'by', header: 'Target Date', type: 'date' },
          ],
          sampleRows: [
            { goal: 'Emergency fund', target: 10000, saved: 3500, by: '2026-12-31' },
            { goal: 'Holiday', target: 2500, saved: 600, by: '2026-08-01' },
          ],
          totals: { target: 'sum', saved: 'sum', left: 'sum' },
        },
        {
          kind: 'summary',
          name: 'Overview',
          title: 'Money Overview',
          metrics: [
            { label: 'Total income', formula: 'SUM({{Income.amount}})', format: 'currency' },
            { label: 'Total spending', formula: 'SUM({{Spending.amount}})', format: 'currency' },
            { label: 'Net cash flow', formula: 'C4-C5', format: 'currency', hint: 'Income minus spending' },
            { label: 'Savings rate', formula: 'IFERROR(C6/C4,0)', format: 'percent', hint: 'Share of income you kept' },
            { label: 'Spent on wants', formula: 'SUMIF({{Spending.need}},"Want",{{Spending.amount}})', format: 'currency' },
          ],
          breakdowns: [
            {
              title: 'Spending by category',
              categories: BUDGET_CATS,
              valueFormula: 'SUMIF({{Spending.category}},{label},{{Spending.amount}})',
              valueHeader: 'Spent',
              format: 'currency',
              dataBar: true,
            },
            {
              title: 'Month by month',
              categories: MONTHS,
              labelHeader: 'Month',
              valueFormula: 'SUMPRODUCT(ISNUMBER({{Income.date}})*(MONTH({{Income.date}})=MATCH({label},{"Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"},0))*{{Income.amount}})',
              valueHeader: 'Income',
              format: 'currency',
              secondary: {
                header: 'Spending',
                valueFormula: 'SUMPRODUCT(ISNUMBER({{Spending.date}})*(MONTH({{Spending.date}})=MATCH({label},{"Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"},0))*{{Spending.amount}})',
                format: 'currency',
              },
            },
          ],
        },
      ],
    };
  },
  seed() {
    return {
      productName: 'Personal Budget and Savings Planner',
      format: 'Excel & Google Sheets template',
      audience: 'anyone who wants a simple, calm way to manage money',
      keywords: [
        'budget planner',
        'budget spreadsheet',
        'savings tracker',
        'expense tracker',
        'monthly budget',
        'money tracker',
        'personal finance',
        'google sheets',
        'excel template',
        'savings goal',
        'finance planner',
        'paycheck budget',
        'debt free',
        'cash flow',
      ],
      features: [
        'Income and spending logs with category dropdowns',
        'Needs vs wants tagging to spot easy savings',
        'Overview with net cash flow and savings rate',
        'Spending by category and month-by-month comparison',
        'Savings goals with automatic progress',
      ],
      includes: ['1 Excel workbook (.xlsx) with 5 tabs', 'Works in Google Sheets, Excel and Numbers'],
      howItWorks: ['Download the file after purchase', 'Open in Excel or upload to Google Sheets', 'Delete the examples and add this month’s income'],
    };
  },
};
