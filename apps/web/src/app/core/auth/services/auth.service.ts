import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest, MeResponse, RefreshResponse } from '@yourtime/shared-types';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  // Signals for reactive state
  private _user = signal<MeResponse | null>(null);
  private _accessToken = signal<string | null>(null);
  private _refreshToken = signal<string | null>(null);
  private _loading = signal(false);

  // Public computed signals
  user = this._user.asReadonly();
  accessToken = this._accessToken.asReadonly();
  isAuthenticated = computed(() => !!this._accessToken());
  loading = this._loading.asReadonly();

  constructor() {
    this.loadTokensFromStorage();
    if (this._accessToken()) {
      this.fetchCurrentUser().subscribe();
    }
  }

  private loadTokensFromStorage(): void {
    const access = localStorage.getItem('access_token');
    const refresh = localStorage.getItem('refresh_token');
    if (access && refresh) {
      this._accessToken.set(access);
      this._refreshToken.set(refresh);
    }
  }

  private saveTokens(access: string, refresh: string): void {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    this._accessToken.set(access);
    this._refreshToken.set(refresh);
  }

  private clearTokens(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    this._accessToken.set(null);
    this._refreshToken.set(null);
    this._user.set(null);
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    this._loading.set(true);
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, credentials).pipe(
      tap((res) => {
        this.saveTokens(res.access_token, res.refresh_token);
        this._user.set(res.user);
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    this._loading.set(true);
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, data).pipe(
      tap((res) => {
        this.saveTokens(res.access_token, res.refresh_token);
        this._user.set(res.user);
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }

  logout(): void {
    this.clearTokens();
    this.router.navigate(['/auth/login']);
  }

  refreshToken(): Observable<RefreshResponse> {
    const refresh = this._refreshToken();
    if (!refresh) {
      return throwError(() => new Error('No refresh token'));
    }
    return this.http.post<RefreshResponse>(`${environment.apiUrl}/auth/refresh`, { refresh_token: refresh }).pipe(
      tap((res) => {
        this._accessToken.set(res.access_token);
        localStorage.setItem('access_token', res.access_token);
      })
    );
  }

  fetchCurrentUser(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${environment.apiUrl}/auth/me`).pipe(
      tap((user) => this._user.set(user))
    );
  }

  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/reset-password`, { token, password });
  }
}