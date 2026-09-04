import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/guards';

export const appRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'tasks',
        pathMatch: 'full',
      },
      {
        path: 'tasks',
        loadChildren: () import('./features/tasks/tasks.routes').then(m => m.tasksRoutes),
      },
      {
        path: 'tokens',
        loadChildren: () => import('./features/tokens/tokens.routes').then(m => m.tokensRoutes),
      },
      {
        path: 'messages',
        loadChildren: () => import('./features/messages/messages.routes').then(m => m.messagesRoutes),
      },
      {
        path: 'profile',
        loadChildren: () => import('./features/profile/profile.routes').then(m => m.profileRoutes),
      },
      {
        path: 'notifications',
        loadChildren: () => import('./features/notifications/notifications.routes').then(m => m.notificationsRoutes),
      },
    ],
  },
  {
    path: 'auth',
    loadComponent: () => import('./layout/auth-layout/auth-layout.component').then(m => m.AuthLayoutComponent),
    canActivate: [guestGuard],
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/pages/login/login.component').then(m => m.LoginComponent),
      },
      {
        path: 'register',
        loadComponent: () => import('./features/auth/pages/register/register.component').then(m => m.RegisterComponent),
      },
      {
        path: 'forgot-password',
        loadComponent: () => import('./features/auth/pages/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
      },
      {
        path: 'reset-password',
        loadComponent: () => import('./features/auth/pages/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'tasks',
  },
];