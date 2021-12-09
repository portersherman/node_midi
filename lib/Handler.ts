export interface Handler {
    config: object;

    setup: Function;
    handleCC: Function;
    handlePC: Function;
    isConfigValid: Function;
    log: Function;
}