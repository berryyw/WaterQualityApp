export interface IngestCityStats {
  cityId: string;
  cityName: string;
  keywords: string[];
  candidatesCollected: number;
  poolsFiltered: number;
  duplicatesSkippedByExtId: number;
  externalIdsAttached: number;
  created: number;
  notAPool: number;
  errors: number;
  dryRun: boolean;
}
