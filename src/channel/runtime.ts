/**
 * runtime.ts — Feishu Plus Runtime Context
 *
 * 存储 OpenClau runtime 对象，供其他模块使用。
 */

let runtime: any = null;

export function setFeishuPlusRuntime(rt: any): void {
  runtime = rt;
}

export function getFeishuPlusRuntime(): any {
  return runtime;
}
