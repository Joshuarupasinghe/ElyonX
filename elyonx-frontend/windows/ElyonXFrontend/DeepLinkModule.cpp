#include "pch.h"
#include "DeepLinkModule.h"

#include <algorithm>

namespace winrt::ElyonXFrontend
{

std::mutex ElyonXDeepLink::s_mutex;
std::string ElyonXDeepLink::s_initialUrl;
std::vector<ElyonXDeepLink *> ElyonXDeepLink::s_modules;

ElyonXDeepLink::ElyonXDeepLink() noexcept
{
  std::scoped_lock lock{s_mutex};
  s_modules.push_back(this);
}

ElyonXDeepLink::~ElyonXDeepLink() noexcept
{
  std::scoped_lock lock{s_mutex};
  auto it = std::find(s_modules.begin(), s_modules.end(), this);
  if (it != s_modules.end()) {
    s_modules.erase(it);
  }
}

void ElyonXDeepLink::Initialize(winrt::Microsoft::ReactNative::ReactContext const &reactContext) noexcept
{
  m_context = reactContext;
}

std::string ElyonXDeepLink::getInitialUrl() noexcept
{
  std::scoped_lock lock{s_mutex};
  return s_initialUrl;
}

void ElyonXDeepLink::addListener(std::string /*eventName*/) noexcept {}

void ElyonXDeepLink::removeListeners(double /*count*/) noexcept {}

void ElyonXDeepLink::OpenUrl(winrt::hstring const &url) noexcept
{
  auto urlString = winrt::to_string(url);
  if (urlString.empty()) {
    return;
  }

  std::vector<ElyonXDeepLink *> modules;
  {
    std::scoped_lock lock{s_mutex};
    if (s_initialUrl.empty()) {
      s_initialUrl = urlString;
    }
    modules = s_modules;
  }

  for (auto module : modules) {
    module->EmitUrl(urlString);
  }
}

void ElyonXDeepLink::EmitUrl(std::string const &url) noexcept
{
  if (m_context == nullptr) {
    return;
  }

  m_context.EmitJSEvent(
      L"RCTDeviceEventEmitter",
      L"elyonxDeepLink",
      winrt::Microsoft::ReactNative::JSValueObject{{"url", url}});
}

} // namespace winrt::ElyonXFrontend
