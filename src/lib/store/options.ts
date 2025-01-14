import { ExtensionStorage } from '$lib/extension/storage';
import { StorageKey } from '$lib/extension/storage/storage.constants';
import { writable } from 'svelte/store';

interface OptionsState {
  disabledWidgetHosts: string[];
  widgetDisabled: boolean;
}

const defaultOptions = {
  widgetDisabled: false,
  disabledWidgetHosts: ['auth0.openai.com', 'chat.openai.com'],
};

const optionsStorage = new ExtensionStorage<OptionsState>(StorageKey.OPTIONS);

export const createOptionsStore = () => {
  const optionsStore = writable<OptionsState>(null);

  optionsStorage.get().then((options) => {
    const optionsState = options || defaultOptions;
    optionsStore.set(optionsState);
  });

  optionsStore.subscribe((optionsState) => {
    optionsStorage.set(optionsState);
  });

  const updateWidgetDisabled = (disabled: boolean) => {
    optionsStore.update((optionsState) => ({
      ...optionsState,
      widgetDisabled: disabled,
    }));
  };

  const toggleWidgetHost = (host: string) => {
    optionsStore.update((optionsState) => {
      let hosts = optionsState.disabledWidgetHosts;

      if (hosts.includes(host)) {
        hosts = hosts.filter((h) => h !== host);
      } else {
        hosts = [...hosts, host];
      }

      return {
        ...optionsState,
        disabledWidgetHosts: hosts,
      };
    });
  };

  return {
    subscribe: optionsStore.subscribe,
    updateWidgetDisabled,
    toggleWidgetHost,
  };
};
