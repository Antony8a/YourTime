import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { SnackbarService } from '../../shared/components/feedback/snackbar/snackbar.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackbar = inject(SnackbarService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let message = 'Ha ocurrido un error inesperado';

      if (error.error?.detail) {
        message = error.error.detail;
      } else if (error.error?.message) {
        message = error.error.message;
      } else if (error.status === 0) {
        message = 'No se puede conectar al servidor';
      } else if (error.status === 404) {
        message = 'Recurso no encontrado';
      } else if (error.status === 403) {
        message = 'No tienes permisos para realizar esta acción';
      } else if (error.status === 422 && error.error?.errors) {
        message = error.error.errors.map((e: any) => e.message).join(', ');
      } else if (error.status >= 500) {
        message = 'Error del servidor. Intenta más tarde';
      }

      snackbar.error(message);
      return throwError(() => error);
    })
  );
};