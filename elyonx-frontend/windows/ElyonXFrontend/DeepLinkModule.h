#pragma once

#include <NativeModules.h>

#include <mutex>
#include <string>
#include <vector>

namespace winrt::ElyonXFrontend
{

REACT_MODULE(ElyonXDeepLink)
struct ElyonXDeepLink
{
  ElyonXDeepLink() noexcept;
  ~ElyonXDeepLink() noexcept;

  REACT_INIT(Initialize)
  void Initialize(winrt::Microsoft::ReactNative::ReactContext const &reactContext) noexcept;

  REACT_SYNC_METHOD(getInitialUrl)
  std::string getInitialUrl() noexcept;

  REACT_METHOD(addListener)
  static void addListener(std::string eventName) noexcept;

  REACT_METHOD(removeListeners)
  static void removeListeners(double count) noexcept;

  static void OpenUrl(winrt::hstring const &url) noexcept;

 private:
  void EmitUrl(std::string const &url) noexcept;

  static std::mutex s_mutex;
  static std::string s_initialUrl;
  static std::vector<ElyonXDeepLink *> s_modules;

  winrt::Microsoft::ReactNative::ReactContext m_context{nullptr};
};

} // namespace winrt::ElyonXFrontend
