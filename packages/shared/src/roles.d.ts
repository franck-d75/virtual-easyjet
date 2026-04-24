export declare const ROLE_CODES: {
    readonly ADMIN: "admin";
    readonly STAFF: "staff";
    readonly PILOT: "pilot";
};
export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];
export declare const DEFAULT_ROLE_CODES: RoleCode[];
