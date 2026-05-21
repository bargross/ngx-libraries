import { NgModule, ModuleWithProviders } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { DataStreamBuilderService, ParamStreamService } from '../services';

@NgModule({})
export class NgxQueryStateModule {
  static forRoot(): ModuleWithProviders<NgxQueryStateModule> {
    return {
      ngModule: NgxQueryStateModule,
      providers: [
        provideHttpClient(),
        DataStreamBuilderService,
        ParamStreamService
      ]
    };
  }
}
