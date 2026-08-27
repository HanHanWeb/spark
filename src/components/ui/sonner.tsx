"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="top-center"
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            // 紧凑胶囊：宽度收缩到内容宽 + 全圆角；在 sonner 固定宽度容器内水平居中
            // （容器 <ol> 由 sonner 固定管理，其子项为绝对定位，不能直接改容器宽）
            // rounded-full! 与 p-4! 用于覆盖内联的 width:var(--width) 与默认圆角
            "cn-toast sm:w-fit! sm:left-0! sm:right-0! sm:mx-auto! rounded-full! border! px-3.5! py-2.5! shadow-md",
          description: "text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
