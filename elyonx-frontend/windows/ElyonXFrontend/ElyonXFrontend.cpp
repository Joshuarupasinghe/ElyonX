// ElyonXFrontend.cpp : Defines the entry point for the application.
//

#include "pch.h"
#include "ElyonXFrontend.h"

#include "AutolinkedNativeModules.g.h"

#include <cwchar>
#include <optional>
#include <shellapi.h>
#include <string>
#include <winrt/Microsoft.Windows.AppLifecycle.h>
#include <winrt/Windows.ApplicationModel.Activation.h>
#include "DeepLinkModule.h"
#include "NativeModules.h"

namespace {

constexpr wchar_t kProtocolScheme[] = L"elyonx";
constexpr wchar_t kAppInstanceKey[] = L"ElyonXFrontend";

std::optional<winrt::Windows::Foundation::Uri> TryCreateProtocolUri(std::wstring const &value) noexcept {
  try {
    winrt::Windows::Foundation::Uri uri{value};
    if (_wcsicmp(uri.SchemeName().c_str(), kProtocolScheme) == 0) {
      return uri;
    }
  } catch (...) {
  }

  return std::nullopt;
}

std::optional<winrt::Windows::Foundation::Uri> FindProtocolUriInCommandLine() noexcept {
  int argc = 0;
  auto argv = CommandLineToArgvW(GetCommandLineW(), &argc);
  if (!argv) {
    return std::nullopt;
  }

  std::optional<winrt::Windows::Foundation::Uri> result;
  for (int i = 1; i < argc; ++i) {
    result = TryCreateProtocolUri(argv[i]);
    if (result) {
      break;
    }
  }

  LocalFree(argv);
  return result;
}

std::optional<winrt::Windows::Foundation::Uri> GetProtocolUriFromActivation(
    winrt::Microsoft::Windows::AppLifecycle::AppActivationArguments const &args) noexcept {
  if (args == nullptr ||
      args.Kind() != winrt::Microsoft::Windows::AppLifecycle::ExtendedActivationKind::Protocol) {
    return std::nullopt;
  }

  auto protocolArgs =
      args.Data().try_as<winrt::Windows::ApplicationModel::Activation::IProtocolActivatedEventArgs>();
  if (!protocolArgs) {
    return std::nullopt;
  }

  return protocolArgs.Uri();
}

winrt::Microsoft::Windows::AppLifecycle::AppActivationArguments GetActivationArguments() noexcept {
  try {
    return winrt::Microsoft::Windows::AppLifecycle::AppInstance::GetCurrent().GetActivatedEventArgs();
  } catch (...) {
    return nullptr;
  }
}

bool RedirectActivationToRunningInstance(
    winrt::Microsoft::Windows::AppLifecycle::AppActivationArguments const &activationArgs) noexcept {
  try {
    auto mainInstance = winrt::Microsoft::Windows::AppLifecycle::AppInstance::FindOrRegisterForKey(kAppInstanceKey);
    if (!mainInstance.IsCurrent() &&
        activationArgs != nullptr &&
        activationArgs.Kind() == winrt::Microsoft::Windows::AppLifecycle::ExtendedActivationKind::Protocol) {
      auto redirectOperation = mainInstance.RedirectActivationToAsync(activationArgs);
      auto completedEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
      if (completedEvent != nullptr) {
        redirectOperation.Completed(
            [completedEvent](auto const &, winrt::Windows::Foundation::AsyncStatus const &) noexcept {
              SetEvent(completedEvent);
            });

        MSG message;
        while (true) {
          auto waitResult = MsgWaitForMultipleObjects(1, &completedEvent, FALSE, INFINITE, QS_ALLINPUT);
          if (waitResult == WAIT_OBJECT_0) {
            break;
          }
          if (waitResult != WAIT_OBJECT_0 + 1) {
            break;
          }

          while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) {
            TranslateMessage(&message);
            DispatchMessageW(&message);
          }
        }

        CloseHandle(completedEvent);
      }
      return true;
    }
  } catch (...) {
  }

  return false;
}

void OpenProtocolUri(winrt::Windows::Foundation::Uri const &uri) noexcept {
  winrt::ElyonXFrontend::ElyonXDeepLink::OpenUrl(uri.AbsoluteUri());
}

} // namespace

// A PackageProvider containing any turbo modules you define within this app project
struct CompReactPackageProvider
    : winrt::implements<CompReactPackageProvider, winrt::Microsoft::ReactNative::IReactPackageProvider> {
 public: // IReactPackageProvider
  void CreatePackage(winrt::Microsoft::ReactNative::IReactPackageBuilder const &packageBuilder) noexcept {
    AddAttributedModules(packageBuilder, true);
  }
};

// The entry point of the Win32 application
_Use_decl_annotations_ int CALLBACK WinMain(HINSTANCE instance, HINSTANCE, PSTR /* commandLine */, int showCmd) {
  // Initialize WinRT
  winrt::init_apartment(winrt::apartment_type::single_threaded);

  auto activationArgs = GetActivationArguments();
  if (RedirectActivationToRunningInstance(activationArgs)) {
    return 0;
  }

  // Enable per monitor DPI scaling
  SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);

  // Find the path hosting the app exe file
  WCHAR appDirectory[MAX_PATH];
  GetModuleFileNameW(NULL, appDirectory, MAX_PATH);
  PathCchRemoveFileSpec(appDirectory, MAX_PATH);

  // Create a ReactNativeWin32App with the ReactNativeAppBuilder
  auto reactNativeWin32App{winrt::Microsoft::ReactNative::ReactNativeAppBuilder().Build()};

  // Configure the initial InstanceSettings for the app's ReactNativeHost
  auto settings{reactNativeWin32App.ReactNativeHost().InstanceSettings()};
  // Register any autolinked native modules
  RegisterAutolinkedNativeModulePackages(settings.PackageProviders());
  // Register any native modules defined within this app project
  settings.PackageProviders().Append(winrt::make<CompReactPackageProvider>());

#if BUNDLE
  // Load the JS bundle from a file (not Metro):
  // Set the path (on disk) where the .bundle file is located
  settings.BundleRootPath(std::wstring(L"file://").append(appDirectory).append(L"\\Bundle\\").c_str());
  // Set the name of the bundle file (without the .bundle extension)
  settings.JavaScriptBundleFile(L"index.windows");
  // Disable hot reload
  settings.UseFastRefresh(false);
#else
  // Load the JS bundle from Metro
  settings.JavaScriptBundleFile(L"index");
  // Enable hot reload
  settings.UseFastRefresh(true);
#endif
#if _DEBUG
  // For Debug builds
  // Enable Direct Debugging of JS
  settings.UseDirectDebugger(true);
  // Enable the Developer Menu
  settings.UseDeveloperSupport(true);
#else
  // For Release builds:
  // Disable Direct Debugging of JS
  settings.UseDirectDebugger(false);
  // Disable the Developer Menu
  settings.UseDeveloperSupport(false);
#endif

  // Get the AppWindow so we can configure its initial title and size
  auto appWindow{reactNativeWin32App.AppWindow()};
  appWindow.Title(L"ElyonX");
  appWindow.Resize({1000, 1000});

  // Get the ReactViewOptions so we can set the initial RN component to load
  auto viewOptions{reactNativeWin32App.ReactViewOptions()};
  viewOptions.ComponentName(L"ElyonX");

  try {
    winrt::Microsoft::Windows::AppLifecycle::AppInstance::GetCurrent().Activated(
        [appWindow](winrt::Windows::Foundation::IInspectable const &,
           winrt::Microsoft::Windows::AppLifecycle::AppActivationArguments const &args) {
          if (auto uri = GetProtocolUriFromActivation(args)) {
            appWindow.Show();
            OpenProtocolUri(*uri);
          }
        });
  } catch (...) {
  }

  auto initialUri = GetProtocolUriFromActivation(activationArgs);
  if (!initialUri) {
    initialUri = FindProtocolUriInCommandLine();
  }

  if (initialUri) {
    OpenProtocolUri(*initialUri);
  }

  // Start the app
  reactNativeWin32App.Start();
}
