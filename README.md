# GiftOps by Evynta

**One system to run a gift-delivery business, from the first enquiry to the final payment.**

GiftOps is built for companies that send gifts to *many* people at once, such as corporate gifting, festival hampers and bulk orders with hundreds of recipients. It replaces the mix of WhatsApp chats, Excel sheets, paper delivery slips and separate billing software with a single place that the whole team uses.

Address: `https://giftops.evynta.in/app`

---

## The story of one order (how everything fits together)

1. **An enquiry arrives.** It comes from a phone call, the website, WhatsApp, Instagram or Facebook. It appears in **Leads**.
2. **Sales follows up and wins it.** One click turns the lead into a **Customer** with an **Order**.
3. **The recipient list is uploaded.** The customer sends an Excel sheet with names, phone numbers and addresses. You upload it into the order.
4. **Missing addresses are chased automatically.** For recipients with no address, the system asks on WhatsApp, then makes an AI call, then gives a person a "please call" task. A person always checks the address before it counts.
5. **Gifts are bought and packed.** Orders to vendors are tracked in **Purchases**. Packing and quality checks are ticked off in **Packing & QC**.
6. **Deliveries are planned.** Stops are grouped into **Delivery runs**, and each run is given to a rider.
7. **The rider delivers.** On a phone, the rider taps call, navigate, delivered, and takes a photo as proof.
8. **The customer is billed.** One click creates a **GST invoice** from the order. Payments are recorded against it.
9. **You see if you made money.** **Reports** show the profit on every order and who owes what.

---

## Every section, in plain words

### Dashboard
Your morning view. It shows what needs attention today: missing addresses, follow-ups due, failed deliveries, how many gifts are out for delivery, money owed to you and money you owe.

### Sales
| Section | What it is for |
|---|---|
| **Leads** | Everyone who has enquired but not yet bought. You can add leads by hand, import them from Excel, or let them arrive automatically from your website, WhatsApp, Instagram or Facebook. The same person is never added twice. You can mark each lead as contacted, qualified, won or lost, and set a follow-up reminder. |
| **Customers** | Companies or people who have bought. It holds their billing details and GST number, and the history of everything you have done for them. |
| **Orders** | The heart of the system. One order = one customer + the items + the list of recipients. It has tabs: Overview, Items, Recipients, Purchases, Finance, Activity. It shows how many gifts are delivered, pending or failed. |
| **Inbox & calls** | Every WhatsApp message and phone call in one timeline, per person. You can reply and note down a call without leaving the page. |

### Operations
| Section | What it is for |
|---|---|
| **Address queue** | A to-do list of recipients whose address is missing or unconfirmed. You see the status of the automatic chase (asked, called, replied) and confirm the final address. |
| **Vendors** | Your suppliers: gift makers, packaging shops, couriers. |
| **Purchases** | What you ordered from vendors for each order, the cost, and whether it has arrived. |
| **Packing & QC** | A checklist for the packing table. Mark each gift packed and quality-checked. |
| **Delivery runs** | A "run sheet" for one rider and one trip. Add stops, set their order, print the sheet, and see the cost of the trip. |
| **Exceptions** | The problems: failed deliveries, wrong addresses, recipient not available. Each one becomes a task so nothing is forgotten. |
| **Rider app** | A simple phone page for riders. They see only their own stops. For each stop they can call, open the map, mark delivered with a photo, or note why it failed. |

### Finance
| Section | What it is for |
|---|---|
| **Invoices** | GST invoices made straight from an order. The tax split (CGST and SGST, or IGST) is worked out automatically. You can print or save as PDF, and issue credit notes for returns or corrections. |
| **Payments received** | Money that came in, with the bank reference. The system stops you recording the same payment twice. |
| **Vendor & courier bills** | Bills you have to pay, and what is still unpaid. |
| **Expenses** | Other costs: fuel, rent, salaries, packaging. You can link an expense to an order so it counts in that order's profit. |
| **Reports** | Profit per order (selling price minus what it cost you), who owes you and for how long, who you owe, and Excel/CSV downloads of every list. |

### Platform (Evynta owners only)
A separate console that lists every company that signed up, their logins, when they last signed in, and simple usage counts (leads, orders). You can add a company, extend a trial, mark it as paying, or suspend it. It shows numbers only, not a company's customer data. Each company's data is kept apart from every other company's.

### Settings & staff (admin only)
- **Company & invoice:** your name, GST number, address, bank and UPI details. These appear on every invoice.
- **Address chase:** how many hours to wait before the WhatsApp reminder, the AI call and the "person must call" task.
- **Staff:** add team members and choose what each can see (see roles below).
- **Integrations:** shows which connections (WhatsApp, AI calling, Instagram, website form) are switched on.
- **Audit log:** a record of who changed what and when.

---

## Who can see what

| Role | Sees |
|---|---|
| **Admin** | Everything, including settings and staff. The person who creates the company account becomes its admin. |
| **Sales** | Leads, customers, orders, inbox, address queue, invoices (view). |
| **Operations** | Orders, vendors, purchases, packing, delivery runs, exceptions, rider app, bills, reports. |
| **Finance** | Customers, orders, invoices, payments, bills, expenses, reports. |
| **Rider** | Only their own rider page on their phone. |

---

## How leads get in (all into one Leads list)

| Source | Status |
|---|---|
| Typed in by staff (phone, referral) | Works now |
| Excel import of old leads | Works now |
| Website form, chatbot, IndiaMART, JustDial, Zapier | Works once you set a secret key (see setup guide) |
| WhatsApp messages | Needs a WhatsApp Business account connected |
| Facebook and Instagram (lead forms and messages) | Needs a Meta app and Meta's approval |

---

## What works today and what needs connecting

**Works as soon as it is deployed:** leads, customers, orders, Excel recipient upload, address queue, vendors, purchases, packing, delivery runs, rider page with photo proof, invoices, payments, bills, expenses, reports, staff logins, website lead form.

**Needs an account or approval first (code is ready, switched off until you connect it):**
- **WhatsApp messages and the automatic address chase.** Needs a WhatsApp Business number approved by Meta and an approved message template.
- **AI phone calls.** Needs an AI-calling provider account.
- **Instagram and Facebook.** Needs a Meta app, and Meta's review for messaging permissions.

Until these are connected, the system still works. The address chase simply creates "please call this person" tasks for your team.

**Not built yet (ideas for later):** replying to Instagram/Facebook messages from inside GiftOps, a customer self-service tracking page, online payment links, e-invoicing / e-way bill, online subscription billing.

---

## Good to know

- **Profit report = gross margin.** It is selling price minus the direct costs of that order. It is not your final accounting profit. Ask your accountant before using it for tax.
- **Addresses are never overwritten automatically.** A reply from WhatsApp or an AI call is only a *suggestion* until a person confirms it.
- **Nothing is deleted by accident.** Important changes are recorded in the audit log.
- **GST.** Fill in your GST number and state in Settings before issuing the first invoice, and have your accountant check the output.
- **Data safety.** Your data lives in your own database account (Supabase). Turn on backups there.

---

## For whoever sets it up (technical, short)

The system is a web app (Next.js) with a Supabase database, hosted on Vercel. Step-by-step setup, the list of settings keys, WhatsApp / AI-call / Instagram connection steps and the daily-chase schedule are in **`RAAHVIA_SETUP.md`**. In short:

1. Run the SQL files in `supabase/migrations/` (010, 011, then 012) in the Supabase SQL editor.
2. Add the environment variables from `.env.example` in Vercel, then redeploy.
3. Set `RV_SUPER_ADMIN_EMAILS` to your email. Open `/app/login`; you will see the **Platform** page listing every company, login and sign-up.
4. A new customer visits `/app/login`, clicks "Start a 14-day free trial", enters a company name and gets a private workspace. You can suspend or activate any company from Platform.

---

*GiftOps is made by Evynta.*
