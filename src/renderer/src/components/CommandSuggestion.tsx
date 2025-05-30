import { useTranslation } from 'react-i18next';

type Props = {
  command: string;
};

export const CommandSuggestion = ({ command }: Props) => {
  const { t } = useTranslation();
  return (
    <div className="flex justify-between items-center w-full">
      <span className="text-xs text-neutral-100">/{command}</span>
      <span className="ml-10 text-neutral-400 text-2xs">{t(`commands.${command}`)}</span>
    </div>
  );
};
