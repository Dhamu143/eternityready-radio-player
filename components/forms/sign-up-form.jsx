"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { SignupFormSchema } from "@/lib/definitions";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignUpForm() {
  const [isLoaded, setIsLoaded] = useState(true);
  const [errors, setErrors] = useState(null);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(SignupFormSchema),
    defaultValues: {
      name: "",
      username: "",
      password: "",
      confirm_password: "",
    },
  });

  async function onSubmit(data) {
    setIsLoaded(false);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      setIsLoaded(true);

      if (!response.ok) {
        console.log("response.error", result.error);
        toast.error(result.error || "Something went wrong.");
        return;
      }

      if (result.errors) {
        setErrors(result.errors);
        return;
      }

      router.push("/admin");
    } catch (error) {
      setIsLoaded(true);
      toast.error(error.message);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
              {errors && errors.name && (
                <FormMessage>{errors.name}</FormMessage>
              )}
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
              {errors && errors.username && (
                <FormMessage>{errors.username}</FormMessage>
              )}
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
              {errors && errors.password && (
                <FormMessage>{errors.username.password}</FormMessage>
              )}
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirm_password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
              {errors && errors.confirm_password && (
                <FormMessage>{errors.username.confirm_password}</FormMessage>
              )}
            </FormItem>
          )}
        />
        <Button type="submit" disabled={!isLoaded}>
          {!isLoaded ? "Submitting..." : "Sign up"}
        </Button>
      </form>
    </Form>
  );
}
