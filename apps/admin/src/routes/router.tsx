import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { ProtectedRoute } from './ProtectedRoute';
import { LandingRedirect } from './LandingRedirect';
import { NotFoundPage } from './NotFoundPage';
import { AccessDeniedState } from '../components/ui/StateViews';
import { LoginPage } from '../features/auth/LoginPage';

import { AdminDashboardPage } from '../features/dashboard/AdminDashboardPage';
import { AnalyticsPage } from '../features/analytics/AnalyticsPage';
import { UsersListPage } from '../features/users/UsersListPage';
import { UserDetailPage } from '../features/users/UserDetailPage';
import { SellersListPage } from '../features/sellers/SellersListPage';
import { SellerDetailPage } from '../features/sellers/SellerDetailPage';
import { CategoriesPage } from '../features/catalog/CategoriesPage';
import { BrandsPage } from '../features/catalog/BrandsPage';
import { ProductModerationPage } from '../features/catalog/ProductModerationPage';
import { OrdersListPage } from '../features/orders/OrdersListPage';
import { OrderDetailPage } from '../features/orders/OrderDetailPage';
import { ReturnsPage } from '../features/returns/ReturnsPage';
import { CouponsPage } from '../features/coupons/CouponsPage';
import { AiAdminPage } from '../features/ai/AiAdminPage';
import { AiConversationDetailPage } from '../features/ai/AiConversationDetailPage';

import { SellerDashboardPage } from '../features/seller-dashboard/SellerDashboardPage';
import { SellerProductsPage } from '../features/seller-dashboard/SellerProductsPage';
import { SellerProductDetailPage } from '../features/seller-dashboard/SellerProductDetailPage';
import { SellerOrdersPage } from '../features/seller-dashboard/SellerOrdersPage';
import { SellerOrderDetailPage } from '../features/seller-dashboard/SellerOrderDetailPage';
import { SellerInventoryPage } from '../features/seller-dashboard/SellerInventoryPage';

import { SupportDashboardPage } from '../features/support/SupportDashboardPage';
import { TicketDetailPage } from '../features/support/TicketDetailPage';

import { AccountPage } from '../features/account/AccountPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/unauthorized', element: <AccessDeniedState /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <LandingRedirect /> },
      {
        path: 'account',
        element: <ProtectedRoute requireAnyOf={['admin', 'seller', 'support_agent']} />,
        children: [{ index: true, element: <AccountPage /> }]
      },
      {
        path: 'admin',
        element: <ProtectedRoute requireAnyOf={['admin']} />,
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: 'analytics', element: <AnalyticsPage /> },
          { path: 'users', element: <UsersListPage /> },
          { path: 'users/:userId', element: <UserDetailPage /> },
          { path: 'sellers', element: <SellersListPage /> },
          { path: 'sellers/:sellerId', element: <SellerDetailPage /> },
          { path: 'catalog/categories', element: <CategoriesPage /> },
          { path: 'catalog/brands', element: <BrandsPage /> },
          { path: 'catalog/products', element: <ProductModerationPage /> },
          { path: 'orders', element: <OrdersListPage /> },
          { path: 'orders/:orderId', element: <OrderDetailPage /> },
          { path: 'returns', element: <ReturnsPage /> },
          { path: 'coupons', element: <CouponsPage /> },
          { path: 'ai', element: <AiAdminPage /> },
          { path: 'ai/conversations/:conversationId', element: <AiConversationDetailPage /> }
        ]
      },
      {
        path: 'seller',
        element: <ProtectedRoute requireAnyOf={['seller']} />,
        children: [
          { index: true, element: <SellerDashboardPage /> },
          { path: 'products', element: <SellerProductsPage /> },
          { path: 'products/:productId', element: <SellerProductDetailPage /> },
          { path: 'orders', element: <SellerOrdersPage /> },
          { path: 'orders/:orderId', element: <SellerOrderDetailPage /> },
          { path: 'inventory', element: <SellerInventoryPage /> }
        ]
      },
      {
        path: 'support',
        element: <ProtectedRoute requireAnyOf={['support_agent', 'admin']} />,
        children: [
          { index: true, element: <SupportDashboardPage /> },
          { path: 'tickets/:ticketId', element: <TicketDetailPage /> }
        ]
      }
    ]
  },
  { path: '*', element: <NotFoundPage /> }
]);
