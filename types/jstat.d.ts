// Minimal typings for the parts of jstat we use (beta inverse CDF for CIs).
declare module "jstat" {
  interface JStatStatic {
    beta: {
      inv(p: number, alpha: number, beta: number): number;
    };
  }
  export const jStat: JStatStatic;
  const _default: { jStat: JStatStatic } & JStatStatic;
  export default _default;
}
