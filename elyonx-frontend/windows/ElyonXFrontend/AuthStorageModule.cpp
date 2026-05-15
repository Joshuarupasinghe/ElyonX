#include "pch.h"
#include "AuthStorageModule.h"

#include <wincred.h>

namespace winrt::ElyonXFrontend
{
namespace
{
constexpr wchar_t kCredentialTarget[] = L"ElyonX/AuthSession";
constexpr wchar_t kCredentialUser[] = L"ElyonX";
}

std::string ElyonXAuthStorage::getSession() noexcept
{
  PCREDENTIALW credential = nullptr;

  if (!CredReadW(kCredentialTarget, CRED_TYPE_GENERIC, 0, &credential) || credential == nullptr) {
    return {};
  }

  std::string session;
  if (credential->CredentialBlob != nullptr && credential->CredentialBlobSize > 0) {
    session.assign(
        reinterpret_cast<const char *>(credential->CredentialBlob),
        credential->CredentialBlobSize);
  }
  CredFree(credential);
  return session;
}

bool ElyonXAuthStorage::setSession(std::string session) noexcept
{
  if (session.empty()) {
    return clearSession();
  }

  if (session.size() > CRED_MAX_CREDENTIAL_BLOB_SIZE) {
    return false;
  }

  CREDENTIALW credential{};
  credential.Type = CRED_TYPE_GENERIC;
  credential.TargetName = const_cast<LPWSTR>(kCredentialTarget);
  credential.CredentialBlobSize = static_cast<DWORD>(session.size());
  credential.CredentialBlob = reinterpret_cast<LPBYTE>(session.data());
  credential.Persist = CRED_PERSIST_LOCAL_MACHINE;
  credential.UserName = const_cast<LPWSTR>(kCredentialUser);

  return CredWriteW(&credential, 0) == TRUE;
}

bool ElyonXAuthStorage::clearSession() noexcept
{
  if (CredDeleteW(kCredentialTarget, CRED_TYPE_GENERIC, 0) == TRUE) {
    return true;
  }

  return GetLastError() == ERROR_NOT_FOUND;
}

} // namespace winrt::ElyonXFrontend
