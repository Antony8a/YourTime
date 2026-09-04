import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { appRoutes } from './app/app.routes';
import { provideHttpClientConfig } from './app/core/http/api-client';
import { authInterceptor } from './app/core/auth/services/auth.interceptor';
import { errorInterceptor } from './app/core/http/interceptors/error.interceptor';
import { loadingInterceptor } from './app/core/http/interceptors/loading.interceptor';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(appRoutes),
    provideHttpClient(
      withInterceptors([
        authInterceptor,
        errorInterceptor,
        loadingInterceptor,
      ])
    ),
    provideAnimations(),
    provideHttpClientConfig(),
  ],
}).catch((err) => console.error(err));