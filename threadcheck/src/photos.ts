import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export async function pickPhoto(camera: boolean): Promise<string | null> {
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted)
      throw new Error(
        "Camera access is off. Enable it in your phone settings, or choose an existing photo.",
      );
  }
  const result = camera
    ? await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      })
    : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
  if (result.canceled) return null;
  return preparePhoto(result.assets[0]);
}

export async function preparePhoto(
  photo: Pick<ImagePicker.ImagePickerAsset, "uri" | "width" | "height">,
): Promise<string> {
  const context = ImageManipulator.manipulate(photo.uri);
  if (Math.max(photo.width, photo.height) > 1200)
    context.resize(
      photo.width >= photo.height ? { width: 1200 } : { height: 1200 },
    );
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.8,
    base64: true,
  });
  if (!saved.base64)
    throw new Error("The photo could not be read. Try a different image.");
  return `data:image/jpeg;base64,${saved.base64}`;
}
