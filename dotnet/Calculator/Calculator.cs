using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;

namespace WasmCalculator;

[SupportedOSPlatform("browser")]
public static partial class Calculator
{
    [JSExport]
    public static double Multiply(double left, double right)
        => FiniteResult(Finite(left) * Finite(right));

    [JSExport]
    public static double Divide(double left, double right)
    {
        Finite(left);
        Finite(right);
        if (right == 0)
            throw new ArgumentException("Cannot divide by zero.");
        return FiniteResult(left / right);
    }

    [JSExport]
    public static double Power(double value, double exponent)
        => FiniteResult(Math.Pow(Finite(value), Finite(exponent)));

    [JSExport]
    public static double Sqrt(double value)
    {
        Finite(value);
        if (value < 0)
            throw new ArgumentException("Square root requires a non-negative number.");
        return Math.Sqrt(value);
    }

    [JSExport]
    public static double Factorial(double value)
    {
        Finite(value);
        if (value < 0 || value != Math.Truncate(value) || value > 170)
            throw new ArgumentException("Factorial requires an integer between 0 and 170.");

        double result = 1;
        for (int i = 2; i <= (int)value; i++)
            result *= i;
        return result;
    }

    private static double Finite(double value)
    {
        if (!double.IsFinite(value))
            throw new ArgumentException("Arguments must be finite numbers.");
        return value;
    }

    private static double FiniteResult(double value)
    {
        if (!double.IsFinite(value))
            throw new ArgumentException("The result is outside the finite real number range.");
        return value;
    }
}
