export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  USER = 'user',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CANCELED = 'canceled',
  PAST_DUE = 'past_due',
  TRIALING = 'trialing',
  UNPAID = 'unpaid',
}

export enum PlanInterval {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELED = 'canceled',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  PIX = 'pix',
}

export enum CleanNameRequestStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum CreditPackageStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum PaymentType {
  SUBSCRIPTION = 'subscription',
  CREDIT_PURCHASE = 'credit_purchase',
}

export enum DocumentStatus {
  PENDING = 'pending',
  SIGNED = 'signed',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export enum Permission {
  // Dashboard
  DASHBOARD_VIEW = 'dashboard:view',

  // Users
  USERS_VIEW = 'users:view',
  USERS_CREATE = 'users:create',
  USERS_UPDATE = 'users:update',
  USERS_DELETE = 'users:delete',

  // Subscriptions
  SUBSCRIPTIONS_VIEW = 'subscriptions:view',
  SUBSCRIPTIONS_CREATE = 'subscriptions:create',
  SUBSCRIPTIONS_UPDATE = 'subscriptions:update',
  SUBSCRIPTIONS_CANCEL = 'subscriptions:cancel',

  // Plans
  PLANS_VIEW = 'plans:view',
  PLANS_MANAGE = 'plans:manage',

  // Clean Name
  CLEAN_NAME_VIEW = 'clean_name:view',
  CLEAN_NAME_REQUEST = 'clean_name:request',

  // Payments
  PAYMENTS_VIEW = 'payments:view',
  PAYMENTS_MANAGE = 'payments:manage',

  // Admin
  ADMIN_PANEL = 'admin:panel',
}
