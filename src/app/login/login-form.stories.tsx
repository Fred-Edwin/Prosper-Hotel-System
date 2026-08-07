import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LoginForm } from "./login-form";

const meta = {
  title: "App/LoginForm",
  component: LoginForm,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

export const Default: Story = {
  args: {
    phone: "",
    pin: "",
    onPhoneChange: noop,
    onPinChange: noop,
    onPhoneBlur: noop,
    onPinBlur: noop,
    onSubmit: (e) => e.preventDefault(),
  },
};

export const FilledIn: Story = {
  args: {
    ...Default.args,
    phone: "+254700000003",
    pin: "1234",
  },
};

export const ValidationError: Story = {
  name: "Validation error — on blur",
  args: {
    ...Default.args,
    phone: "",
    pinError: "PIN is 4 digits",
    pin: "12",
  },
};

export const WrongCredentials: Story = {
  args: {
    ...Default.args,
    phone: "+254700000999",
    pin: "0000",
    formError: "Wrong phone number or PIN.",
  },
};

export const Submitting: Story = {
  args: {
    ...Default.args,
    phone: "+254700000003",
    pin: "1234",
    submitting: true,
  },
};
