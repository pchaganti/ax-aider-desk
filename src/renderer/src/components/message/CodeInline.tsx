type Props = {
  children: string;
};

export const CodeInline = ({ children }: Props) => {
  return <span className="bg-gray-950 border border-neutral-800 text-white rounded-sm px-1 py-0.5 text-2xs font-semibold">{children}</span>;
};
