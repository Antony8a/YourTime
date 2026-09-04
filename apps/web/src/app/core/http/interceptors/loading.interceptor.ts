import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { LoadingService } from '../../shared/components/feedback/spinner/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loading = inject(LoadingService);

  // Skip loading for certain requests
  if (req.headers.has('X-Skip-Loading')) {
    return next(req);
  }

  loading.show();
  return next(req).pipe(
    finalize(() => loading.hide())
  );
};