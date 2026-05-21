import { NgModule, ModuleWithProviders } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { DataStreamService, ParamStreamBuilderService } from '../services';

@NgModule({})
export class NgxQueryStateModule {
  static forRoot(): ModuleWithProviders<NgxQueryStateModule> {
    return {
      ngModule: NgxQueryStateModule,
      providers: [
        provideHttpClient(),
        DataStreamService,
        ParamStreamBuilderService
      ]
    };
  }
}
