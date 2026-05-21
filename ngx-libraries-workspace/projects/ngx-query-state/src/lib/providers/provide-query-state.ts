// providers/provide-query-state.ts
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { ParamStreamService, DataStreamBuilderService, PaginatedHttpService } from '../services';

export function provideQueryState(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideHttpClient(),
    PaginatedHttpService,
    DataStreamBuilderService,
    ParamStreamService
  ]);
}

/**
 * Alternative function name for semantic clarity.
 * Same as provideQueryState().
 */
export const provideNgxQueryState = provideQueryState;
