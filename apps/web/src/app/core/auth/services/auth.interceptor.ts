import { Injectable, inject } from '@angular/core';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const authService = inject(AuthService);
  const accessToken = authService.accessToken();

  // Skip auth for login/register/refresh
  const isAuthEndpoint = req.url.includes('/auth/login') || 
                         req.url.includes('/auth/register') || 
                         req.url.includes('/auth/refresh') ||
                         req.url.includes('/auth/forgot-password') ||
                         req.url.includes('/auth/reset-password');

  if (isAuthEndpoint) {
    return next(req);
  }

  // Add authorization header
  if (accessToken) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${accessToken}` },
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isAuthEndpoint) {
        // Try to refresh token
        return authService.refreshToken().pipe(
          switchMap(() => {
            const newToken = authService.accessToken();
            if (newToken) {
              const newReq = req.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` },
              });
              return next(newReq);
            }
            authService.logout();
            return throwError(() => error);
          }),
          catchError(() => {
            authService.logout();
            return throwError(() => error);
          })
        );
      }
      return throwError(() => error);
    })
  );
};