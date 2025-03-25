export enum MatchStatus {
    MATCH = 'Match',
    SIMILAR_MATCH = 'Similar Match',
    MISMATCH = 'Mismatch'
}

export interface Property {
    description: string;
    limit: string;
    mortgageAmount: string;
}

export interface ReportEntry {
    list1Desc: string;
    list2Desc: string;
    status: MatchStatus;
    details: string;
}

export interface WorkerResult {
    report: ReportEntry[];
    matchedPolicies: number[];
}

export interface MatchResult {
    match: boolean;
    details: string;
}
