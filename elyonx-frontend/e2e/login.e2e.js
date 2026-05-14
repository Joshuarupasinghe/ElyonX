describe('ElyonX Windows login smoke', () => {
  it('launches to the login screen', async () => {
    await expect($('~ElyonX')).toBeDisplayed();
    await expect($('~Email address')).toBeDisplayed();
    await expect($('~Password')).toBeDisplayed();
    await expect($('~Login')).toBeDisplayed();
  });
});
