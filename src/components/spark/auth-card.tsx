"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type AuthMode = "login" | "register";

/**
 * 登录 / 注册二合一表单（控制面板与首次使用引导共用）。
 * 成功后的收尾动作由调用方通过 onSuccess 决定（会带出本次模式：
 * 引导页据此区分「登录直达」与「注册走完整流程」），默认关面板、进入下一步等。
 */
export function AuthCard({
  onLogin,
  onRegister,
  onSuccess,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
  onSuccess: (mode: AuthMode) => void;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || !email.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    const fn = mode === "login" ? onLogin : onRegister;
    fn(email.trim().toLowerCase(), password)
      .then(() => {
        toast.success(mode === "login" ? "登录成功" : "注册成功，已登录");
        onSuccess(mode);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error && err.message ? err.message : "出错了，请稍后重试"
        );
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Tabs value={mode} onValueChange={(v) => setMode(v as AuthMode)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">登录</TabsTrigger>
          <TabsTrigger value="register">注册</TabsTrigger>
        </TabsList>
      </Tabs>
      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="邮箱"
        autoComplete="email"
      />
      <Input
        type="password"
        required
        minLength={6}
        maxLength={64}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={mode === "register" ? "密码（至少 6 位）" : "密码"}
        autoComplete={mode === "register" ? "new-password" : "current-password"}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? <Spinner className="size-4" /> : null}
        {mode === "login" ? "登录" : "创建账号"}
      </Button>
    </form>
  );
}
