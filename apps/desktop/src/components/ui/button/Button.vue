<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    variant?: "default" | "outline" | "destructive" | "ghost";
    size?: "default" | "sm" | "icon";
    class?: string;
  }>(),
  {
    variant: "default",
    size: "default",
  },
);

const classes = computed(() =>
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
    {
      "bg-primary text-primary-foreground hover:bg-primary/90": props.variant === "default",
      "border border-input bg-background hover:bg-muted": props.variant === "outline",
      "bg-destructive text-destructive-foreground hover:bg-destructive/90": props.variant === "destructive",
      "hover:bg-muted": props.variant === "ghost",
      "h-10 px-4 py-2": props.size === "default",
      "h-8 rounded-md px-3 text-xs": props.size === "sm",
      "h-9 w-9": props.size === "icon",
    },
    props.class,
  ),
);
</script>

<template>
  <button :class="classes">
    <slot />
  </button>
</template>
