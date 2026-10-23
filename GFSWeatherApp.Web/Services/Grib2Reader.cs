using System.Buffers.Binary;

namespace GFSWeatherApp.Web.Services;

public sealed class GribField
{
    public int Discipline { get; set; }
    public int Category { get; set; }
    public int Number { get; set; }
    public int? AccHours { get; set; }          // accumulation length in hours (product template 4.8)
    public int Ni { get; set; }
    public int Nj { get; set; }
    public double Lat1 { get; set; }
    public double Lon1 { get; set; }
    public double Lat2 { get; set; }
    public double Lon2 { get; set; }
    public double Di { get; set; }
    public double Dj { get; set; }
    public int ScanMode { get; set; }
    public float[] Values { get; set; } = Array.Empty<float>();   // file scan order, NaN = missing

    public bool Is(int d, int c, int n) => Discipline == d && Category == c && Number == n;

    /// Rows ordered north -> south, columns west -> east.
    public float[][] ToGrid()
    {
        var g = new float[Nj][];
        for (int j = 0; j < Nj; j++)
        {
            g[j] = new float[Ni];
            Array.Copy(Values, j * Ni, g[j], 0, Ni);
        }
        if ((ScanMode & 0x40) != 0) Array.Reverse(g);                 // rows ran south -> north
        if ((ScanMode & 0x80) != 0) foreach (var r in g) Array.Reverse(r); // columns ran east -> west
        return g;
    }

    public double[] Lats()
    {
        var top = Math.Max(Lat1, Lat2);
        var r = new double[Nj];
        for (int j = 0; j < Nj; j++) r[j] = Math.Round(top - j * Dj, 4);
        return r;
    }

    public double[] Lons()
    {
        var left = Math.Min(Lon1, Lon2);
        if (left > 180) left -= 360;
        var r = new double[Ni];
        for (int i = 0; i < Ni; i++) r[i] = Math.Round(left + i * Di, 4);
        return r;
    }
}
/// Minimal GRIB2 reader: lat/lon grids (3.0), simple packing (5.0),
/// complex packing (5.2) and complex packing + spatial differencing (5.3).
public static class Grib2Reader
{
    public static List<GribField> Read(byte[] d)
    {
        var result = new List<GribField>();
        int off = 0;
        while (off + 16 <= d.Length && d[off] == 'G' && d[off + 1] == 'R' && d[off + 2] == 'I' && d[off + 3] == 'B')
        {
            if (d[off + 7] != 2) throw new NotSupportedException("Only GRIB edition 2 is supported.");
            int discipline = d[off + 6];
            long total = (long)BinaryPrimitives.ReadUInt64BigEndian(d.AsSpan(off + 8));
            int end = (int)Math.Min(off + total, d.Length);
            int p = off + 16;
            int s3 = -1, s4 = -1, s5 = -1, s6 = -1;

            while (p + 5 <= end)
            {
                if (d[p] == '7' && d[p + 1] == '7' && d[p + 2] == '7' && d[p + 3] == '7') break;
                long len = U32(d, p);
                int sec = d[p + 4];
                if (len < 5) throw new InvalidDataException("Corrupt GRIB section length.");
                switch (sec)
                {
                    case 3: s3 = p; break;
                    case 4: s4 = p; break;
                    case 5: s5 = p; break;
                    case 6: s6 = p; break;
                    case 7: result.Add(Decode(d, discipline, s3, s4, s5, s6, p)); break;
                }
                p += (int)len;
            }
            off = end;
        }
        return result;
    }

    private static GribField Decode(byte[] d, int disc, int s3, int s4, int s5, int s6, int s7)
    {
        if (s3 < 0 || s4 < 0 || s5 < 0 || s6 < 0) throw new InvalidDataException("Incomplete GRIB message.");

        var f = new GribField { Discipline = disc };

        int gridTemplate = U16(d, s3 + 12);
        if (gridTemplate != 0) throw new NotSupportedException($"Grid template 3.{gridTemplate} is not supported (only lat/lon).");
        f.Ni = (int)U32(d, s3 + 30);
        f.Nj = (int)U32(d, s3 + 34);
        f.Lat1 = SM32(d, s3 + 46) / 1e6;
        f.Lon1 = SM32(d, s3 + 50) / 1e6;
        f.Lat2 = SM32(d, s3 + 55) / 1e6;
        f.Lon2 = SM32(d, s3 + 59) / 1e6;
        f.Di = U32(d, s3 + 63) / 1e6;
        f.Dj = U32(d, s3 + 67) / 1e6;
        f.ScanMode = d[s3 + 71];

        int prodTemplate = U16(d, s4 + 7);
        f.Category = d[s4 + 9];
        f.Number = d[s4 + 10];
        if (prodTemplate == 8 && U32(d, s4) >= 53 && d[s4 + 48] == 1)   // unit 1 = hour
            f.AccHours = (int)U32(d, s4 + 49);

        int npts = (int)U32(d, s5 + 5);
        float[] packed = Unpack(d, s5, s7, npts);
        int total = f.Ni * f.Nj;
        int bitmap = d[s6 + 5];

        if (bitmap == 255)
        {
            if (packed.Length != total) throw new InvalidDataException("Grid size does not match data count.");
            f.Values = packed;
        }
        else if (bitmap == 0)
        {
            var vals = new float[total];
            int k = 0;
            for (int i = 0; i < total; i++)
            {
                bool present = ((d[s6 + 6 + (i >> 3)] >> (7 - (i & 7))) & 1) == 1;
                vals[i] = present ? packed[k++] : float.NaN;
            }
            f.Values = vals;
        }
        else throw new NotSupportedException($"Bitmap indicator {bitmap} is not supported.");

        return f;
    }

    private static float[] Unpack(byte[] d, int s5, int s7, int npts)
    {
        int tmpl = U16(d, s5 + 9);
        double R = BinaryPrimitives.ReadSingleBigEndian(d.AsSpan(s5 + 11));
        int E = SM16(d, s5 + 15);
        int D = SM16(d, s5 + 17);
        int nbits = d[s5 + 19];
        double bin = Math.Pow(2, E), dec = Math.Pow(10, -D);
        var x = new long[npts];

        if (tmpl == 0)
        {
            var br = new BitReader(d, s7 + 5);
            for (int i = 0; i < npts; i++) x[i] = br.Read(nbits);
        }
        else if (tmpl == 2 || tmpl == 3)
        {
            int ng = (int)U32(d, s5 + 31);
            int refW = d[s5 + 35];
            int bitsW = d[s5 + 36];
            long refL = U32(d, s5 + 37);
            int incL = d[s5 + 41];
            long lastL = U32(d, s5 + 42);
            int bitsL = d[s5 + 46];
            int order = 0, extra = 0;
            if (tmpl == 3) { order = d[s5 + 47]; extra = d[s5 + 48]; }
            if (ng <= 0) throw new InvalidDataException("No groups in complex packing.");

            int p = s7 + 5;
            long ival1 = 0, ival2 = 0, minsd = 0;
            if (order > 0)
            {
                ival1 = SMn(d, p, extra); p += extra;
                if (order == 2) { ival2 = SMn(d, p, extra); p += extra; }
                minsd = SMn(d, p, extra); p += extra;
            }

            var br = new BitReader(d, p);
            var gref = new long[ng];
            for (int g = 0; g < ng; g++) gref[g] = br.Read(nbits);
            br.Align();
            var gw = new int[ng];
            for (int g = 0; g < ng; g++) gw[g] = (int)br.Read(bitsW) + refW;
            br.Align();
            var gl = new long[ng];
            for (int g = 0; g < ng; g++) gl[g] = br.Read(bitsL) * incL + refL;
            gl[ng - 1] = lastL;
            br.Align();

            long sum = 0;
            foreach (var l in gl) sum += l;
            if (sum != npts) throw new InvalidDataException($"Group lengths ({sum}) do not match point count ({npts}).");

            int k = 0;
            for (int g = 0; g < ng; g++)
                for (long i = 0; i < gl[g]; i++)
                    x[k++] = gref[g] + (gw[g] == 0 ? 0 : br.Read(gw[g]));

            if (order == 1)
            {
                x[0] = ival1;
                for (int n = 1; n < npts; n++) { x[n] += minsd; x[n] += x[n - 1]; }
            }
            else if (order == 2 && npts >= 2)
            {
                x[0] = ival1; x[1] = ival2;
                for (int n = 2; n < npts; n++) { x[n] += minsd; x[n] = x[n] + 2 * x[n - 1] - x[n - 2]; }
            }
        }
        else
        {
            throw new NotSupportedException(
                $"GRIB2 packing template 5.{tmpl} is not supported by this decoder (supported: 5.0, 5.2, 5.3).");
        }

        var r = new float[npts];
        for (int i = 0; i < npts; i++) r[i] = (float)((R + x[i] * bin) * dec);
        return r;
    }

    // ---- big-endian helpers ----
    private static int U16(byte[] d, int o) => (d[o] << 8) | d[o + 1];
    private static long U32(byte[] d, int o) => ((long)d[o] << 24) | ((long)d[o + 1] << 16) | ((long)d[o + 2] << 8) | d[o + 3];
    private static int SM16(byte[] d, int o) { int v = U16(d, o); return (v & 0x8000) != 0 ? -(v & 0x7FFF) : v; }
    private static int SM32(byte[] d, int o) { long v = U32(d, o); return (v & 0x80000000L) != 0 ? -(int)(v & 0x7FFFFFFFL) : (int)v; }
    private static long SMn(byte[] d, int o, int n)
    {
        long v = 0;
        for (int i = 0; i < n; i++) v = (v << 8) | d[o + i];
        long sign = 1L << (8 * n - 1);
        return (v & sign) != 0 ? -(v & (sign - 1)) : v;
    }

    private sealed class BitReader
    {
        private readonly byte[] _b;
        private int _pos; // bit position

        public BitReader(byte[] b, int byteOffset) { _b = b; _pos = byteOffset * 8; }

        public uint Read(int n)
        {
            ulong v = 0;
            int remaining = n;
            while (remaining > 0)
            {
                int idx = _pos >> 3;
                if (idx >= _b.Length) throw new InvalidDataException("Unexpected end of GRIB data.");
                int avail = 8 - (_pos & 7);
                int take = Math.Min(avail, remaining);
                int bits = (_b[idx] >> (avail - take)) & ((1 << take) - 1);
                v = (v << take) | (uint)bits;
                _pos += take;
                remaining -= take;
            }
            return (uint)v;
        }

        public void Align() => _pos = (_pos + 7) & ~7;
    }
}
