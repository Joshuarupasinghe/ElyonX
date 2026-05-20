import {
  DeviceEventEmitter,
  Linking,
  NativeModules,
  Platform,
} from 'react-native';

type DeepLinkSubscription = {
  remove: () => void;
};

type NativeDeepLinkModule = {
  getInitialUrl: () => string | null;
};

type DeepLinkEvent = {
  url?: string;
};

const nativeDeepLink =
  Platform.OS === 'windows'
    ? ((NativeModules as Record<string, unknown>)
        .ElyonXDeepLink as NativeDeepLinkModule | undefined)
    : undefined;

export async function getInitialDeepLinkUrl(): Promise<string | null> {
  const nativeInitialUrl = nativeDeepLink?.getInitialUrl?.();
  if (nativeInitialUrl) {
    return nativeInitialUrl;
  }

  return Linking.getInitialURL();
}

export function addDeepLinkListener(
  listener: (url: string) => void,
): DeepLinkSubscription {
  const subscriptions: DeepLinkSubscription[] = [
    Linking.addEventListener('url', event => listener(event.url)),
  ];

  if (nativeDeepLink) {
    subscriptions.push(
      DeviceEventEmitter.addListener('elyonxDeepLink', (event: DeepLinkEvent) => {
        if (event?.url) {
          listener(event.url);
        }
      }),
    );
  }

  return {
    remove: () => {
      subscriptions.forEach(subscription => subscription.remove());
    },
  };
}
