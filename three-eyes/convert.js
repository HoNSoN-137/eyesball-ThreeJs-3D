import com.aspose.imaging.Image;
import com.aspose.imaging.ImageOptionsBase;
import com.aspose.imaging.fileformats.jpeg2000.Jpeg2000Codec;
import com.aspose.imaging.fileformats.png.PngColorType;
import com.aspose.imaging.fileformats.tiff.enums.TiffExpectedFormat;
import com.aspose.imaging.imageoptions.*;


//This example demonstrates how to convert all supported file formats from one to another
String templatesFolder = "D:\\WorkDir\\";

//Formats that support both - save and load
HashMap<String, ImageOptionsBase> formatsThatSupportExportAndImport = new HashMap<String, ImageOptionsBase>();
formatsThatSupportExportAndImport.put("bmp", new BmpOptions());
formatsThatSupportExportAndImport.put("gif", new GifOptions());
formatsThatSupportExportAndImport.put("dicom", new DicomOptions());
formatsThatSupportExportAndImport.put("emf", new EmfOptions());
formatsThatSupportExportAndImport.put("jpg", new JpegOptions());
formatsThatSupportExportAndImport.put("jpeg", new JpegOptions());
formatsThatSupportExportAndImport.put("jpeg2000", new Jpeg2000Options() );
formatsThatSupportExportAndImport.put("j2k", new Jpeg2000Options() {{ setCodec(Jpeg2000Codec.J2K); }} );
formatsThatSupportExportAndImport.put("jp2", new Jpeg2000Options()  {{ setCodec(Jpeg2000Codec.Jp2); }} );
formatsThatSupportExportAndImport.put("png",new PngOptions() {{ setColorType(PngColorType.TruecolorWithAlpha); }});
formatsThatSupportExportAndImport.put("apng", new ApngOptions());
formatsThatSupportExportAndImport.put("svg", new SvgOptions());
formatsThatSupportExportAndImport.put("tiff", new TiffOptions(TiffExpectedFormat.Default));
formatsThatSupportExportAndImport.put("tif", new TiffOptions(TiffExpectedFormat.Default));
formatsThatSupportExportAndImport.put("wmf", new WmfOptions());
formatsThatSupportExportAndImport.put("emz", new EmfOptions() {{ setCompress(true); }});
formatsThatSupportExportAndImport.put("wmz", new WmfOptions() {{ setCompress(true); }});
formatsThatSupportExportAndImport.put("svgz", new SvgOptions(){{ setCompress(true); }});
formatsThatSupportExportAndImport.put("tga", new TgaOptions());
formatsThatSupportExportAndImport.put("webp", new WebPOptions());
formatsThatSupportExportAndImport.put("ico", new IcoOptions());

//Formats that can be only saved
HashMap<String, ImageOptionsBase> formatsOnlyForExport = new HashMap<String, ImageOptionsBase>();
formatsOnlyForExport.put("psd", new PsdOptions());
formatsOnlyForExport.put("dxf", new DxfOptions() {{ setTextAsLines(true); setConvertTextBeziers(true); }} );
formatsOnlyForExport.put("pdf", new PdfOptions());
formatsOnlyForExport.put("html", new Html5CanvasOptions());

//Formats that can be only loaded
List<String> formatsOnlyForImport = Arrays.asList("djvu", "dng", "dib", "eps", "cdr", "cmx", "otg", "odg");

//Get total formats that can be saved
HashMap<String, ImageOptionsBase> exportToFormats = new HashMap<String, ImageOptionsBase>(formatsOnlyForExport);
exportToFormats.putAll(formatsThatSupportExportAndImport);

//Get total formats that can be loaded
List<String> importFormats = new LinkedList<>(formatsOnlyForImport);
importFormats.addAll(formatsThatSupportExportAndImport.keySet());

importFormats.forEach((formatExt) -> {
	String inputFile = templatesFolder + "template." + formatExt;

	for (Map.Entry<String, ImageOptionsBase> exportFormat : exportToFormats.entrySet())
	{
		String outputFile = String.format("%s\\%s\\%s-%s-to-%s.%s", templatesFolder, "convert", "convert-", formatExt, exportFormat.getKey(), exportFormat.getKey());
		System.out.println(outputFile);
		// More about load method can be found at
		// https://apireference.aspose.com/imaging/java/com.aspose.imaging/Image#load-java.lang.String-
		try (Image image = Image.load(inputFile))
		{
			ImageOptionsBase exportOptions = exportFormat.getValue().deepClone();
			if ((formatExt.equals("emf") || formatExt.equals("emz")) && (exportFormat.getValue() instanceof WmfOptions))
			{
				EmfRasterizationOptions rasterizationOptions = new EmfRasterizationOptions();
				rasterizationOptions.setPageWidth(image.getWidth());
				rasterizationOptions.setPageHeight(image.getHeight());

				exportOptions.setVectorRasterizationOptions(rasterizationOptions);
			}

			image.save(outputFile, exportOptions);
		}
	}
});