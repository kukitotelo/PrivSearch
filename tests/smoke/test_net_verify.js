const { app, session } = require("electron");
const { NetworkLayer } = require("../../dist/main/NetworkLayer");

app.whenReady().then(async () => {
  const net = new NetworkLayer();
  const ses = session.fromPartition("test-direct");
  await net.applyToSession(ses);
  console.log("INITIAL_ROUTE:", net.getStatus().configuredRoute);
  console.log("INITIAL_VERIFICATION:", net.getStatus().routeVerification);

  const res = await net.verifyRouteWithSession(ses);
  console.log("VERIFY_RESULT:", res);
  console.log("DETECTED_ROUTE:", net.getStatus().detectedRoute);
  console.log("EXIT_IP_PRESENT:", !!net.getStatus().exitIP);

  app.exit(0);
});
