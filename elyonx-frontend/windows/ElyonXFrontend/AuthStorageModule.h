#pragma once

#include <NativeModules.h>

#include <string>

namespace winrt::ElyonXFrontend
{

REACT_MODULE(ElyonXAuthStorage)
struct ElyonXAuthStorage
{
  REACT_SYNC_METHOD(getSession)
  std::string getSession() noexcept;

  REACT_SYNC_METHOD(setSession)
  bool setSession(std::string session) noexcept;

  REACT_SYNC_METHOD(clearSession)
  bool clearSession() noexcept;
};

} // namespace winrt::ElyonXFrontend
