// providers/provide-query-state.ts
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { DataStreamService, ParamStreamBuilderService, PaginatedHttpService } from '../services';

export function provideQueryState(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideHttpClient(),
    PaginatedHttpService,
    DataStreamService,
    ParamStreamBuilderService
  ]);
}

/**
 * Alternative function name for semantic clarity.
 * Same as provideQueryState().
 */
export const provideNgxQueryState = provideQueryState;
