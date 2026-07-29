import { NgClass, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LocalizedDatePipe } from '../../core/i18n/localized-date.pipe';
import { LocaleService } from '../../core/i18n/locale.service';
import { GroupedNumberPipe } from '../../shared/grouped-number.pipe';
import { LanguageSwitcher } from '../../shared/language-switcher/language-switcher';

type OrderStatus = 'Paid' | 'Pending' | 'Refunded';
type AdminView = 'overview' | 'orders' | 'customers' | 'analytics' | 'settings';

/**
 * `customer` and `product` hold either a translation key (seeded demo data) or the raw
 * text a user typed in the new-order form.
 */
interface OrderRow {
  id: string;
  customer: string;
  product: string;
  amount: number;
  status: OrderStatus;
  date: string;
}

interface NewOrderForm {
  customer: string;
  product: string;
  amount: number | null;
  status: OrderStatus;
  date: Date | null;
}

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  plan: string;
  orders: number;
  spent: number;
  status: 'Active' | 'Trial' | 'Churned';
}

interface NavItem {
  id: AdminView;
  icon: string;
  labelKey: string;
}

@Component({
  selector: 'app-admin-demo',
  imports: [
    RouterLink,
    FormsModule,
    NgClass,
    NgTemplateOutlet,
    TranslatePipe,
    LocalizedDatePipe,
    GroupedNumberPipe,
    LanguageSwitcher,
    MatToolbarModule,
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatSlideToggleModule,
  ],
  templateUrl: './admin-demo.html',
  styleUrl: './admin-demo.scss',
})
export class AdminDemo {
  private readonly locale = inject(LocaleService);
  private readonly translate = inject(TranslateService);

  readonly lang = this.locale.lang;

  readonly activeView = signal<AdminView>('overview');
  readonly sidenavOpen = signal(true);
  readonly newOrderOpen = signal(false);
  readonly newOrderSubmitted = signal(false);
  readonly newOrder = signal<NewOrderForm>(this.emptyOrder());

  readonly navItems: NavItem[] = [
    { id: 'overview', icon: 'dashboard', labelKey: 'demo.nav.overview' },
    { id: 'orders', icon: 'receipt_long', labelKey: 'demo.nav.orders' },
    { id: 'customers', icon: 'people', labelKey: 'demo.nav.customers' },
    { id: 'analytics', icon: 'insights', labelKey: 'demo.nav.analytics' },
    { id: 'settings', icon: 'settings', labelKey: 'demo.nav.settings' },
  ];

  readonly kpis = [
    {
      labelKey: 'demo.kpi.revenue',
      value: '$48,290',
      delta: '+12.4%',
      up: true,
      icon: 'payments',
    },
    {
      labelKey: 'demo.kpi.orders',
      value: '1,284',
      delta: '+5.1%',
      up: true,
      icon: 'shopping_cart',
    },
    {
      labelKey: 'demo.kpi.activeUsers',
      value: '8,942',
      delta: '+2.8%',
      up: true,
      icon: 'group',
    },
    {
      labelKey: 'demo.kpi.refundRate',
      value: '1.6%',
      delta: '-0.4%',
      up: false,
      icon: 'undo',
    },
  ];

  readonly chartBars = [
    { labelKey: 'demo.chart.mon', value: 42 },
    { labelKey: 'demo.chart.tue', value: 58 },
    { labelKey: 'demo.chart.wed', value: 51 },
    { labelKey: 'demo.chart.thu', value: 72 },
    { labelKey: 'demo.chart.fri', value: 66 },
    { labelKey: 'demo.chart.sat', value: 39 },
    { labelKey: 'demo.chart.sun', value: 47 },
  ];

  readonly analyticsMetrics = [
    { labelKey: 'demo.analytics.conversion', value: '3.8%', trend: '+0.6%', up: true },
    { labelKey: 'demo.analytics.avgOrder', value: '$37.60', trend: '+$2.10', up: true },
    { labelKey: 'demo.analytics.churn', value: '2.1%', trend: '-0.3%', up: true },
    { labelKey: 'demo.analytics.support', value: '14m', trend: '-3m', up: true },
  ];

  readonly displayedColumns = ['id', 'customer', 'product', 'amount', 'status', 'date'];
  readonly customerColumns = ['name', 'email', 'plan', 'orders', 'spent', 'status'];

  private readonly orderRecords = signal<OrderRow[]>([
    {
      id: 'ORD-1042',
      customer: 'demo.data.customers.nora',
      product: 'demo.data.products.pro',
      amount: 129,
      status: 'Paid',
      date: '2026-07-20',
    },
    {
      id: 'ORD-1041',
      customer: 'demo.data.customers.james',
      product: 'demo.data.products.team',
      amount: 49,
      status: 'Pending',
      date: '2026-07-19',
    },
    {
      id: 'ORD-1040',
      customer: 'demo.data.customers.lina',
      product: 'demo.data.products.analytics',
      amount: 89,
      status: 'Paid',
      date: '2026-07-19',
    },
    {
      id: 'ORD-1039',
      customer: 'demo.data.customers.omar',
      product: 'demo.data.products.pro',
      amount: 129,
      status: 'Refunded',
      date: '2026-07-18',
    },
    {
      id: 'ORD-1038',
      customer: 'demo.data.customers.mia',
      product: 'demo.data.products.starter',
      amount: 19,
      status: 'Paid',
      date: '2026-07-18',
    },
    {
      id: 'ORD-1037',
      customer: 'demo.data.customers.ethan',
      product: 'demo.data.products.team',
      amount: 49,
      status: 'Paid',
      date: '2026-07-17',
    },
    {
      id: 'ORD-1036',
      customer: 'demo.data.customers.sara',
      product: 'demo.data.products.analytics',
      amount: 89,
      status: 'Pending',
      date: '2026-07-16',
    },
    {
      id: 'ORD-1035',
      customer: 'demo.data.customers.daniel',
      product: 'demo.data.products.pro',
      amount: 129,
      status: 'Paid',
      date: '2026-07-15',
    },
  ]);

  private readonly customerRecords: CustomerRow[] = [
    {
      id: 'CUS-201',
      name: 'demo.data.customers.nora',
      email: 'nora@acme.io',
      plan: 'demo.data.products.pro',
      orders: 18,
      spent: 2140,
      status: 'Active',
    },
    {
      id: 'CUS-202',
      name: 'demo.data.customers.james',
      email: 'james@northwind.dev',
      plan: 'demo.data.products.team',
      orders: 9,
      spent: 890,
      status: 'Trial',
    },
    {
      id: 'CUS-203',
      name: 'demo.data.customers.lina',
      email: 'lina@studio.co',
      plan: 'demo.data.products.analytics',
      orders: 12,
      spent: 1320,
      status: 'Active',
    },
    {
      id: 'CUS-204',
      name: 'demo.data.customers.omar',
      email: 'omar@retail.app',
      plan: 'demo.data.products.pro',
      orders: 6,
      spent: 640,
      status: 'Churned',
    },
    {
      id: 'CUS-205',
      name: 'demo.data.customers.mia',
      email: 'mia@startup.io',
      plan: 'demo.data.products.starter',
      orders: 4,
      spent: 210,
      status: 'Active',
    },
    {
      id: 'CUS-206',
      name: 'demo.data.customers.ethan',
      email: 'ethan@labs.tech',
      plan: 'demo.data.products.team',
      orders: 11,
      spent: 980,
      status: 'Active',
    },
  ];

  readonly search = signal('');
  readonly statusFilter = signal<'All' | OrderStatus>('All');
  readonly customerSearch = signal('');
  readonly emailAlerts = signal(true);
  readonly weeklyDigest = signal(true);
  readonly darkSidebar = signal(true);

  readonly localizedOrders = computed<OrderRow[]>(() =>
    this.orderRecords().map((order) => ({
      ...order,
      customer: this.label(order.customer),
      product: this.label(order.product),
    })),
  );

  readonly localizedCustomers = computed<CustomerRow[]>(() =>
    this.customerRecords.map((customer) => ({
      ...customer,
      name: this.label(customer.name),
      plan: this.label(customer.plan),
    })),
  );

  readonly filteredOrders = computed(() => this.filterOrders(this.search(), this.statusFilter()));

  readonly recentOrders = computed(() => this.filteredOrders().slice(0, 5));

  readonly filteredCustomers = computed(() => {
    const query = this.customerSearch().trim().toLowerCase();
    const customers = this.localizedCustomers();
    if (!query) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        c.plan.toLowerCase().includes(query),
    );
  });

  readonly pageTitleKey = computed(() => `demo.pages.${this.activeView()}.title`);
  readonly pageSubtitleKey = computed(() => `demo.pages.${this.activeView()}.subtitle`);

  homeLink(): string[] {
    return ['/', this.locale.lang()];
  }

  setView(view: AdminView): void {
    this.activeView.set(view);
    if (window.innerWidth < 960) {
      this.sidenavOpen.set(false);
    }
  }

  toggleSidenav(): void {
    this.sidenavOpen.update((open) => !open);
  }

  statusKey(status: OrderStatus | 'All'): string {
    const map: Record<OrderStatus | 'All', string> = {
      All: 'demo.orders.all',
      Paid: 'demo.orders.paid',
      Pending: 'demo.orders.pending',
      Refunded: 'demo.orders.refunded',
    };
    return map[status];
  }

  customerStatusKey(status: CustomerRow['status']): string {
    const map: Record<CustomerRow['status'], string> = {
      Active: 'demo.customers.active',
      Trial: 'demo.customers.trial',
      Churned: 'demo.customers.churned',
    };
    return map[status];
  }

  initials(name: string): string {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  onSearch(value: string): void {
    this.search.set(value);
  }

  onStatusChange(value: 'All' | OrderStatus): void {
    this.statusFilter.set(value);
  }

  onCustomerSearch(value: string): void {
    this.customerSearch.set(value);
  }

  exportOrders(): void {
    const rows = this.filteredOrders();
    const headers = [
      'demo.orders.colOrder',
      'demo.orders.colCustomer',
      'demo.orders.colProduct',
      'demo.orders.colAmount',
      'demo.orders.colStatus',
      'demo.orders.colDate',
    ].map((key) => this.label(key));

    const csv = [headers, ...rows.map((order) => [
      order.id,
      order.customer,
      order.product,
      order.amount,
      this.label(this.statusKey(order.status)),
      order.date,
    ])]
      .map((row) => row.map((cell) => this.escapeCsv(cell)).join(','))
      .join('\r\n');

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `nova-ops-orders-${this.toIsoDate(new Date())}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  openNewOrder(): void {
    this.newOrder.set(this.emptyOrder());
    this.newOrderSubmitted.set(false);
    this.newOrderOpen.set(true);
  }

  closeNewOrder(): void {
    this.newOrderOpen.set(false);
    this.newOrderSubmitted.set(false);
  }

  updateNewOrder<K extends keyof NewOrderForm>(field: K, value: NewOrderForm[K]): void {
    this.newOrder.update((order) => ({ ...order, [field]: value }));
  }

  saveNewOrder(): void {
    this.newOrderSubmitted.set(true);
    const form = this.newOrder();
    const customer = form.customer.trim();
    const product = form.product.trim();
    const amount = form.amount ?? 0;
    const date = form.date;

    if (!customer || !product || amount <= 0 || !date) {
      return;
    }

    const nextNumber = Math.max(
      ...this.orderRecords().map((order) => Number(order.id.replace(/\D/g, '')) || 0),
    ) + 1;

    this.orderRecords.update((orders) => [
      {
        id: `ORD-${nextNumber}`,
        customer,
        product,
        amount,
        status: form.status,
        date: this.toIsoDate(date),
      },
      ...orders,
    ]);
    this.search.set('');
    this.statusFilter.set('All');
    this.activeView.set('orders');
    this.closeNewOrder();
  }

  /** Resolves a translation key, or passes through free text entered by the user. */
  private label(value: string): string {
    this.translate.currentLang();
    const translated = this.translate.instant(value);
    return typeof translated === 'string' && translated ? translated : value;
  }

  private filterOrders(query: string, status: 'All' | OrderStatus): OrderRow[] {
    const normalized = query.trim().toLowerCase();
    return this.localizedOrders().filter((order) => {
      const matchesStatus = status === 'All' || order.status === status;
      const matchesQuery =
        !normalized ||
        order.id.toLowerCase().includes(normalized) ||
        order.customer.toLowerCase().includes(normalized) ||
        order.product.toLowerCase().includes(normalized);
      return matchesStatus && matchesQuery;
    });
  }

  private emptyOrder(): NewOrderForm {
    const now = new Date();
    return {
      customer: '',
      product: '',
      amount: null,
      status: 'Pending',
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    };
  }

  /** Orders are always stored as Gregorian ISO dates, regardless of the displayed calendar. */
  private toIsoDate(date: Date): string {
    const year = String(date.getFullYear()).padStart(4, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private escapeCsv(value: string | number): string {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
}
