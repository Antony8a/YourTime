import { InjectionToken, provideExperimentalZonelessChangeDetection } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => environment.apiUrl,
});

export function provideHttpClientConfig() {
  return provideExperimentalZonelessChangeDetection();
}

export interface ApiClientConfig {
  baseUrl: string;
  defaultHeaders?: HttpHeaders;
}

export const DEFAULT_API_CONFIG: ApiClientConfig = {
  baseUrl: environment.apiUrl,
  defaultHeaders: new HttpHeaders({ 'Content-Type': 'application/json' }),
};